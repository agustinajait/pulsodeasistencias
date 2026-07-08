import { Router } from "express";
import { pool } from "@workspace/db";
import { resolveCenter } from "../middleware/auth.js";

const router = Router();

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS convivir_entregas (
      id SERIAL PRIMARY KEY,
      center_id INTEGER NOT NULL,
      fecha DATE NOT NULL,
      proveedor VARCHAR(200) NOT NULL DEFAULT 'Ministerio',
      items TEXT,
      comprobante_base64 TEXT,
      observaciones TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS convivir_entregas_center_fecha_idx ON convivir_entregas(center_id, fecha DESC)`);
}

// GET /convivir/entregas?centerId=X&month=YYYY-MM
router.get("/convivir/entregas", async (req, res) => {
  try {
    await ensureTables();
    const effectiveCenterId = resolveCenter(req, (req.query as any).centerId);
    const { month } = req.query as { month?: string };

    const params: any[] = [];
    const conditions: string[] = [];

    if (effectiveCenterId) {
      params.push(effectiveCenterId);
      conditions.push(`center_id = $${params.length}`);
    }
    if (month) {
      params.push(`${month}-01`);
      conditions.push(`fecha >= $${params.length}`);
      params.push(`${month}-01`);
      conditions.push(`fecha < (DATE($${params.length}) + INTERVAL '1 month')`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT id, center_id AS "centerId", fecha, proveedor, items, comprobante_base64 AS "comprobanteBase64", observaciones, created_at AS "createdAt"
       FROM convivir_entregas ${where} ORDER BY fecha DESC, created_at DESC`,
      params
    );
    res.json(rows.map((r: any) => ({ ...r, fecha: r.fecha.toISOString().slice(0, 10) })));
  } catch (err) {
    req.log.error(err, "Error listing entregas");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /convivir/entregas
router.post("/convivir/entregas", async (req, res) => {
  try {
    await ensureTables();
    const effectiveCenterId = resolveCenter(req, req.body.centerId);
    const { fecha, proveedor, items, comprobanteBase64, observaciones } = req.body;
    if (!effectiveCenterId || !fecha) {
      res.status(400).json({ error: "centerId y fecha son requeridos" });
      return;
    }
    const { rows } = await pool.query(
      `INSERT INTO convivir_entregas (center_id, fecha, proveedor, items, comprobante_base64, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, center_id AS "centerId", fecha, proveedor, items, comprobante_base64 AS "comprobanteBase64", observaciones, created_at AS "createdAt"`,
      [effectiveCenterId, fecha, proveedor ?? "Ministerio", items ?? null, comprobanteBase64 ?? null, observaciones ?? null]
    );
    const r = rows[0];
    res.status(201).json({ ...r, fecha: r.fecha.toISOString().slice(0, 10) });
  } catch (err) {
    req.log.error(err, "Error creating entrega");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /convivir/entregas/:id
router.delete("/convivir/entregas/:id", async (req, res) => {
  try {
    await ensureTables();
    await pool.query(`DELETE FROM convivir_entregas WHERE id=$1`, [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Error deleting entrega");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /convivir/entregas/:id
router.patch("/convivir/entregas/:id", async (req, res) => {
  try {
    await ensureTables();
    const { fecha, proveedor, items, comprobanteBase64, observaciones } = req.body;
    const { rows } = await pool.query(
      `UPDATE convivir_entregas SET fecha=$1, proveedor=$2, items=$3, comprobante_base64=$4, observaciones=$5
       WHERE id=$6
       RETURNING id, center_id AS "centerId", fecha, proveedor, items, comprobante_base64 AS "comprobanteBase64", observaciones, created_at AS "createdAt"`,
      [fecha, proveedor, items ?? null, comprobanteBase64 ?? null, observaciones ?? null, Number(req.params.id)]
    );
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    const r = rows[0];
    res.json({ ...r, fecha: r.fecha.toISOString().slice(0, 10) });
  } catch (err) {
    req.log.error(err, "Error updating entrega");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
