import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_records (
      id SERIAL PRIMARY KEY,
      center_id INTEGER NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(200),
      date_done DATE,
      next_due_date DATE,
      provider_id INTEGER,
      provider_name VARCHAR(200),
      certificate_url TEXT,
      observations TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

function computeStatus(nextDueDate: string | null): "VENCIDO" | "POR_VENCER" | "AL_DIA" {
  if (!nextDueDate) return "AL_DIA";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate);
  due.setHours(0, 0, 0, 0);
  if (due < today) return "VENCIDO";
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  if (due <= in30) return "POR_VENCER";
  return "AL_DIA";
}

// GET /services?centerId=X
router.get("/services", async (req, res) => {
  try {
    await ensureTable();
    const centerId = parseInt(req.query.centerId as string);
    if (isNaN(centerId)) { res.status(400).json({ error: "centerId required" }); return; }
    const result = await pool.query(
      `SELECT
         id,
         center_id AS "centerId",
         type,
         title,
         date_done AS "dateDone",
         next_due_date AS "nextDueDate",
         provider_id AS "providerId",
         provider_name AS "providerName",
         certificate_url AS "certificateUrl",
         observations,
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM service_records
       WHERE center_id = $1
       ORDER BY next_due_date ASC NULLS LAST`,
      [centerId]
    );
    const rows = result.rows.map((r: any) => ({
      ...r,
      status: computeStatus(r.nextDueDate),
    }));
    res.json(rows);
  } catch (err) {
    req.log.error(err, "Error listing services");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /services
router.post("/services", async (req, res) => {
  try {
    await ensureTable();
    const { centerId, type, title, dateDone, nextDueDate, providerId, providerName, certificateUrl, observations } = req.body;
    if (!centerId || !type) { res.status(400).json({ error: "centerId and type required" }); return; }
    const result = await pool.query(
      `INSERT INTO service_records
         (center_id, type, title, date_done, next_due_date, provider_id, provider_name, certificate_url, observations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING
         id,
         center_id AS "centerId",
         type,
         title,
         date_done AS "dateDone",
         next_due_date AS "nextDueDate",
         provider_id AS "providerId",
         provider_name AS "providerName",
         certificate_url AS "certificateUrl",
         observations,
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [centerId, type, title ?? null, dateDone ?? null, nextDueDate ?? null, providerId ?? null, providerName ?? null, certificateUrl ?? null, observations ?? null]
    );
    const row = { ...result.rows[0], status: computeStatus(result.rows[0].nextDueDate) };
    res.status(201).json(row);
  } catch (err) {
    req.log.error(err, "Error creating service");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /services/:id
router.put("/services/:id", async (req, res) => {
  try {
    await ensureTable();
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { type, title, dateDone, nextDueDate, providerId, providerName, certificateUrl, observations } = req.body;
    const result = await pool.query(
      `UPDATE service_records SET
         type = COALESCE($1, type),
         title = $2,
         date_done = $3,
         next_due_date = $4,
         provider_id = $5,
         provider_name = $6,
         certificate_url = $7,
         observations = $8,
         updated_at = NOW()
       WHERE id = $9
       RETURNING
         id,
         center_id AS "centerId",
         type,
         title,
         date_done AS "dateDone",
         next_due_date AS "nextDueDate",
         provider_id AS "providerId",
         provider_name AS "providerName",
         certificate_url AS "certificateUrl",
         observations,
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [type ?? null, title ?? null, dateDone ?? null, nextDueDate ?? null, providerId ?? null, providerName ?? null, certificateUrl ?? null, observations ?? null, id]
    );
    if (result.rowCount === 0) { res.status(404).json({ error: "Not found" }); return; }
    const row = { ...result.rows[0], status: computeStatus(result.rows[0].nextDueDate) };
    res.json(row);
  } catch (err) {
    req.log.error(err, "Error updating service");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /services/:id
router.delete("/services/:id", async (req, res) => {
  try {
    await ensureTable();
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const result = await pool.query(`DELETE FROM service_records WHERE id = $1`, [id]);
    if (result.rowCount === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Error deleting service");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
