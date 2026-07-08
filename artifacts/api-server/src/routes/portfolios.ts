import { Router } from "express";
import { pool } from "@workspace/db";
import { resolveCenter } from "../middleware/auth.js";

const router = Router();

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolio_photos (
      id SERIAL PRIMARY KEY,
      child_id INTEGER NOT NULL,
      fecha DATE NOT NULL DEFAULT CURRENT_DATE,
      titulo VARCHAR(200),
      photo_base64 TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS portfolio_photos_child_id_idx ON portfolio_photos(child_id)`);
}

// GET /portfolios?childId=X
router.get("/portfolios", async (req, res) => {
  try {
    await ensureTable();
    const { childId } = req.query;
    if (!childId) {
      res.status(400).json({ error: "childId required" });
      return;
    }
    const { rows } = await pool.query(
      `SELECT id, child_id AS "childId", fecha, titulo, photo_base64 AS "photoBase64", created_at AS "createdAt"
       FROM portfolio_photos WHERE child_id = $1 ORDER BY fecha DESC, created_at DESC`,
      [Number(childId)]
    );
    res.json(rows.map((r: any) => ({ ...r, fecha: r.fecha.toISOString().slice(0, 10) })));
  } catch (err) {
    req.log.error(err, "Error listing portfolio photos");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /portfolios  { childId, fecha, titulo?, photoBase64 }
router.post("/portfolios", async (req, res) => {
  try {
    await ensureTable();
    const { childId, fecha, titulo, photoBase64 } = req.body;
    if (!childId || !photoBase64) {
      res.status(400).json({ error: "childId and photoBase64 are required" });
      return;
    }
    const { rows } = await pool.query(
      `INSERT INTO portfolio_photos (child_id, fecha, titulo, photo_base64)
       VALUES ($1, $2, $3, $4)
       RETURNING id, child_id AS "childId", fecha, titulo, photo_base64 AS "photoBase64", created_at AS "createdAt"`,
      [Number(childId), fecha ?? new Date().toISOString().slice(0, 10), titulo ?? null, photoBase64]
    );
    const r = rows[0];
    res.status(201).json({ ...r, fecha: r.fecha.toISOString().slice(0, 10) });
  } catch (err) {
    req.log.error(err, "Error uploading portfolio photo");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /portfolios/:id
router.delete("/portfolios/:id", async (req, res) => {
  try {
    await ensureTable();
    await pool.query(`DELETE FROM portfolio_photos WHERE id = $1`, [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Error deleting portfolio photo");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
