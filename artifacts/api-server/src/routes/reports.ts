import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS child_reports (
      id SERIAL PRIMARY KEY,
      child_id INTEGER NOT NULL,
      period VARCHAR(100) NOT NULL,
      eco_number INTEGER,
      lider VARCHAR(200),
      facilitadora VARCHAR(200),
      hitos JSONB NOT NULL DEFAULT '{}',
      textos JSONB NOT NULL DEFAULT '{}',
      observaciones TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE child_reports ADD COLUMN IF NOT EXISTS textos JSONB NOT NULL DEFAULT '{}'`);
  await pool.query(`ALTER TABLE child_reports ALTER COLUMN period TYPE VARCHAR(100)`);
}

// GET /reports?centerId=X&ecoNumber=Y&period=Z  — all reports for a center
router.get("/reports", async (req, res) => {
  try {
    await ensureTable();
    const { centerId, ecoNumber, period } = req.query;
    const conditions: string[] = ["ch.center_id = $1"];
    const params: any[] = [Number(centerId)];
    if (ecoNumber) { params.push(Number(ecoNumber)); conditions.push(`r.eco_number = $${params.length}`); }
    if (period) { params.push(period); conditions.push(`r.period = $${params.length}`); }
    const where = conditions.join(" AND ");
    const { rows } = await pool.query(
      `SELECT r.id, r.child_id AS "childId", ch.nombre, ch.apellido, r.period,
              r.eco_number AS "ecoNumber", r.lider, r.facilitadora, r.hitos, r.textos,
              r.observaciones, r.created_at AS "createdAt", r.updated_at AS "updatedAt"
       FROM child_reports r
       JOIN children ch ON ch.id = r.child_id
       WHERE ${where}
       ORDER BY ch.apellido, ch.nombre, r.period DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    req.log.error(err, "Error listing all reports");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /children/:id/reports
router.get("/children/:id/reports", async (req, res) => {
  try {
    await ensureTable();
    const childId = parseInt(req.params.id);
    if (isNaN(childId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const result = await pool.query(
      `SELECT id, child_id AS "childId", period, eco_number AS "ecoNumber", lider, facilitadora, hitos, textos, observaciones, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM child_reports WHERE child_id = $1 ORDER BY created_at DESC`,
      [childId]
    );
    res.json(result.rows);
  } catch (err) {
    req.log.error(err, "Error listing reports");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /children/:id/reports
router.post("/children/:id/reports", async (req, res) => {
  try {
    await ensureTable();
    const childId = parseInt(req.params.id);
    if (isNaN(childId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { period, ecoNumber, lider, facilitadora, hitos, textos, observaciones } = req.body as Record<string, any>;
    if (!period) { res.status(400).json({ error: "period is required" }); return; }
    const result = await pool.query(
      `INSERT INTO child_reports (child_id, period, eco_number, lider, facilitadora, hitos, textos, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, child_id AS "childId", period, eco_number AS "ecoNumber", lider, facilitadora, hitos, textos, observaciones, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [childId, period, ecoNumber ?? null, lider ?? null, facilitadora ?? null, JSON.stringify(hitos ?? {}), JSON.stringify(textos ?? {}), observaciones ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    req.log.error(err, "Error creating report");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /children/:id/reports/:reportId
router.put("/children/:id/reports/:reportId", async (req, res) => {
  try {
    const reportId = parseInt(req.params.reportId);
    if (isNaN(reportId)) { res.status(400).json({ error: "Invalid reportId" }); return; }
    const { period, ecoNumber, lider, facilitadora, hitos, textos, observaciones } = req.body as Record<string, any>;
    const result = await pool.query(
      `UPDATE child_reports
       SET period = COALESCE($2, period),
           eco_number = COALESCE($3, eco_number),
           lider = $4,
           facilitadora = $5,
           hitos = COALESCE($6::jsonb, hitos),
           textos = COALESCE($7::jsonb, textos),
           observaciones = $8,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, child_id AS "childId", period, eco_number AS "ecoNumber", lider, facilitadora, hitos, textos, observaciones, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [reportId, period ?? null, ecoNumber ?? null, lider ?? null, facilitadora ?? null, hitos ? JSON.stringify(hitos) : null, textos ? JSON.stringify(textos) : null, observaciones ?? null]
    );
    if (!result.rows.length) { res.status(404).json({ error: "Report not found" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    req.log.error(err, "Error updating report");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /children/:id/reports/:reportId
router.delete("/children/:id/reports/:reportId", async (req, res) => {
  try {
    const reportId = parseInt(req.params.reportId);
    if (isNaN(reportId)) { res.status(400).json({ error: "Invalid reportId" }); return; }
    await pool.query(`DELETE FROM child_reports WHERE id = $1`, [reportId]);
    res.json({ status: "deleted" });
  } catch (err) {
    req.log.error(err, "Error deleting report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
