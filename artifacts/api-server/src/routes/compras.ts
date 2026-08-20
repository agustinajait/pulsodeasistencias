import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS materiales_catalogo (
      id SERIAL PRIMARY KEY,
      center_id INTEGER NOT NULL,
      nombre VARCHAR(300) NOT NULL,
      unidad VARCHAR(50) DEFAULT 'unid.',
      ultimo_precio NUMERIC(10,2),
      ultimo_proveedor VARCHAR(200),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(center_id, nombre)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS proveedores_compras (
      id SERIAL PRIMARY KEY,
      center_id INTEGER NOT NULL,
      nombre VARCHAR(200) NOT NULL,
      contacto VARCHAR(200),
      telefono VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS materiales_pedidos (
      id SERIAL PRIMARY KEY,
      center_id INTEGER NOT NULL,
      mes VARCHAR(7) NOT NULL,
      nombre VARCHAR(300) NOT NULL,
      cantidad NUMERIC(10,2) DEFAULT 1,
      unidad VARCHAR(50) DEFAULT 'unid.',
      precio_unitario NUMERIC(10,2) DEFAULT 0,
      proveedor VARCHAR(200),
      estado VARCHAR(30) DEFAULT 'pendiente',
      notas TEXT,
      orden INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ── Catálogo ──────────────────────────────────────────────────────────────

// GET /compras/catalogo?centerId=
router.get("/compras/catalogo", async (req, res) => {
  await ensureTables();
  const centerId = req.query.centerId ?? req.auth?.centerId;
  if (!centerId) return res.json([]);
  const { rows } = await pool.query(
    `SELECT * FROM materiales_catalogo WHERE center_id=$1 ORDER BY nombre`,
    [centerId]
  );
  res.json(rows.map(r => ({
    id: r.id, nombre: r.nombre, unidad: r.unidad,
    ultimoPrecio: r.ultimo_precio ? parseFloat(r.ultimo_precio) : null,
    ultimoProveedor: r.ultimo_proveedor,
  })));
});

// ── Proveedores ───────────────────────────────────────────────────────────

// GET /compras/proveedores?centerId=
router.get("/compras/proveedores", async (req, res) => {
  await ensureTables();
  const centerId = req.query.centerId ?? req.auth?.centerId;
  if (!centerId) return res.json([]);
  const { rows } = await pool.query(
    `SELECT * FROM proveedores_compras WHERE center_id=$1 ORDER BY nombre`,
    [centerId]
  );
  res.json(rows);
});

// POST /compras/proveedores
router.post("/compras/proveedores", async (req, res) => {
  await ensureTables();
  const centerId = req.body.centerId ?? req.auth?.centerId;
  const { nombre, contacto, telefono } = req.body;
  if (!centerId || !nombre) return res.status(400).json({ error: "centerId y nombre requeridos" });
  const { rows } = await pool.query(
    `INSERT INTO proveedores_compras (center_id, nombre, contacto, telefono) VALUES ($1,$2,$3,$4) RETURNING *`,
    [centerId, nombre, contacto ?? null, telefono ?? null]
  );
  res.status(201).json(rows[0]);
});

// DELETE /compras/proveedores/:id
router.delete("/compras/proveedores/:id", async (req, res) => {
  await ensureTables();
  await pool.query(`DELETE FROM proveedores_compras WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

// ── Pedidos ───────────────────────────────────────────────────────────────

// GET /compras/pedidos?centerId=&mes=
router.get("/compras/pedidos", async (req, res) => {
  await ensureTables();
  const centerId = req.query.centerId ?? req.auth?.centerId;
  const { mes } = req.query as { mes?: string };
  if (!centerId) return res.json([]);
  const q = mes
    ? `SELECT * FROM materiales_pedidos WHERE center_id=$1 AND mes=$2 ORDER BY orden, id`
    : `SELECT * FROM materiales_pedidos WHERE center_id=$1 ORDER BY mes DESC, orden, id`;
  const params = mes ? [centerId, mes] : [centerId];
  const { rows } = await pool.query(q, params);
  res.json(rows.map(r => ({
    id: r.id, mes: r.mes, nombre: r.nombre, cantidad: parseFloat(r.cantidad),
    unidad: r.unidad, precioUnitario: parseFloat(r.precio_unitario),
    proveedor: r.proveedor, estado: r.estado, notas: r.notas, orden: r.orden,
  })));
});

// POST /compras/pedidos
router.post("/compras/pedidos", async (req, res) => {
  await ensureTables();
  const centerId = req.body.centerId ?? req.auth?.centerId;
  const { mes, items } = req.body as {
    mes: string;
    items: { nombre: string; cantidad: number; unidad: string; precioUnitario: number; proveedor?: string; notas?: string }[];
  };
  if (!centerId || !mes || !items?.length) return res.status(400).json({ error: "Faltan datos" });

  const result = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const { rows } = await pool.query(
      `INSERT INTO materiales_pedidos (center_id, mes, nombre, cantidad, unidad, precio_unitario, proveedor, notas, orden)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [centerId, mes, it.nombre, it.cantidad, it.unidad, it.precioUnitario, it.proveedor ?? null, it.notas ?? null, i]
    );
    result.push(rows[0]);

    // Update catalog
    await pool.query(`
      INSERT INTO materiales_catalogo (center_id, nombre, unidad, ultimo_precio, ultimo_proveedor, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (center_id, nombre)
      DO UPDATE SET unidad=$3, ultimo_precio=$4, ultimo_proveedor=$5, updated_at=NOW()
    `, [centerId, it.nombre, it.unidad, it.precioUnitario || null, it.proveedor ?? null]);
  }
  res.status(201).json(result);
});

// PUT /compras/pedidos/:id
router.put("/compras/pedidos/:id", async (req, res) => {
  await ensureTables();
  const { nombre, cantidad, unidad, precioUnitario, proveedor, estado, notas } = req.body;
  const { rows } = await pool.query(
    `UPDATE materiales_pedidos SET nombre=$1, cantidad=$2, unidad=$3, precio_unitario=$4,
     proveedor=$5, estado=$6, notas=$7, updated_at=NOW()
     WHERE id=$8 RETURNING *`,
    [nombre, cantidad, unidad, precioUnitario, proveedor ?? null, estado ?? "pendiente", notas ?? null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });

  // Update catalog
  const centerId = rows[0].center_id;
  await pool.query(`
    INSERT INTO materiales_catalogo (center_id, nombre, unidad, ultimo_precio, ultimo_proveedor, updated_at)
    VALUES ($1,$2,$3,$4,$5,NOW())
    ON CONFLICT (center_id, nombre)
    DO UPDATE SET unidad=$3, ultimo_precio=$4, ultimo_proveedor=$5, updated_at=NOW()
  `, [centerId, nombre, unidad, precioUnitario || null, proveedor ?? null]);

  res.json(rows[0]);
});

// DELETE /compras/pedidos/:id
router.delete("/compras/pedidos/:id", async (req, res) => {
  await ensureTables();
  await pool.query(`DELETE FROM materiales_pedidos WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

// GET /compras/pedidos/desde-planificaciones?centerId=&mes=
// Pull all materials from planificacion_bloques for a given month/center
router.get("/compras/pedidos/desde-planificaciones", async (req, res) => {
  await ensureTables();
  const centerId = req.query.centerId ?? req.auth?.centerId;
  const { mes } = req.query as { mes?: string };
  if (!centerId || !mes) return res.json([]);
  const { rows } = await pool.query(`
    SELECT pb.materiales
    FROM planificacion_bloques pb
    JOIN planificaciones p ON pb.planificacion_id = p.id
    WHERE p.center_id = $1 AND p.mes = $2
  `, [centerId, mes]);

  const seen = new Set<string>();
  const result: string[] = [];
  rows.forEach(r => {
    (r.materiales ?? "").split("\n").forEach((line: string) => {
      const clean = line.replace(/^[-•*]\s*/, "").trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        result.push(clean);
      }
    });
  });
  res.json(result);
});

export default router;
