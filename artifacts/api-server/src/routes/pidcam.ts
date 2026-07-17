import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pidcam_evaluaciones (
      id SERIAL PRIMARY KEY,
      center_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      tipo VARCHAR(20) NOT NULL DEFAULT 'semestre',
      secciones JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// GET /pidcam?centerId=X&year=Y
router.get("/pidcam", async (req, res) => {
  try {
    await ensureTable();
    const { centerId, year } = req.query as { centerId?: string; year?: string };
    const conditions: string[] = [];
    const params: any[] = [];
    if (centerId) { params.push(Number(centerId)); conditions.push(`center_id = $${params.length}`); }
    if (year) { params.push(Number(year)); conditions.push(`year = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT id, center_id AS "centerId", year, tipo, secciones,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM pidcam_evaluaciones ${where}
       ORDER BY year DESC, tipo ASC`,
      params
    );
    res.json(rows);
  } catch (err: any) {
    req.log.error(err, "Error listing pidcam evaluaciones");
    res.status(500).json({ error: "Internal server error", detail: err?.message });
  }
});

// POST /pidcam
router.post("/pidcam", async (req, res) => {
  try {
    await ensureTable();
    const { centerId, year, tipo, secciones } = req.body;
    if (!centerId || !year || !tipo) { res.status(400).json({ error: "centerId, year and tipo are required" }); return; }
    const { rows } = await pool.query(
      `INSERT INTO pidcam_evaluaciones (center_id, year, tipo, secciones)
       VALUES ($1, $2, $3, $4)
       RETURNING id, center_id AS "centerId", year, tipo, secciones,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [centerId, year, tipo, JSON.stringify(secciones ?? {})]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    req.log.error(err, "Error creating pidcam evaluacion");
    res.status(500).json({ error: "Internal server error", detail: err?.message });
  }
});

// PUT /pidcam/:id
router.put("/pidcam/:id", async (req, res) => {
  try {
    await ensureTable();
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { secciones } = req.body;
    const { rows } = await pool.query(
      `UPDATE pidcam_evaluaciones
       SET secciones=$2, updated_at=NOW()
       WHERE id=$1
       RETURNING id, center_id AS "centerId", year, tipo, secciones,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, JSON.stringify(secciones ?? {})]
    );
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch (err: any) {
    req.log.error(err, "Error updating pidcam evaluacion");
    res.status(500).json({ error: "Internal server error", detail: err?.message });
  }
});

// DELETE /pidcam/:id
router.delete("/pidcam/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    await pool.query(`DELETE FROM pidcam_evaluaciones WHERE id=$1`, [id]);
    res.json({ status: "deleted" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error", detail: err?.message });
  }
});

export default router;
