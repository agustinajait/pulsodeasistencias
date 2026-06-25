import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS planificaciones (
      id SERIAL PRIMARY KEY,
      center_id INTEGER NOT NULL,
      room_id INTEGER,
      mes VARCHAR(7) NOT NULL,
      lider_pedagogica VARCHAR(200),
      facilitadoras TEXT,
      observaciones TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS planificacion_bloques (
      id SERIAL PRIMARY KEY,
      planificacion_id INTEGER NOT NULL,
      nombre VARCHAR(200) NOT NULL,
      actividades TEXT,
      materiales TEXT,
      inicio TEXT,
      desarrollo TEXT,
      cierre TEXT,
      orden INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

function bloqueToDto(r: any) {
  return {
    id: r.id,
    planificacionId: r.planificacion_id,
    nombre: r.nombre,
    actividades: r.actividades,
    materiales: r.materiales,
    inicio: r.inicio,
    desarrollo: r.desarrollo,
    cierre: r.cierre,
    orden: r.orden,
  };
}

function planToDto(r: any, bloques: any[] = []) {
  return {
    id: r.id,
    centerId: r.center_id,
    roomId: r.room_id,
    mes: r.mes,
    liderPedagogica: r.lider_pedagogica,
    facilitadoras: r.facilitadoras,
    observaciones: r.observaciones,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    bloques: bloques.map(bloqueToDto),
  };
}

// GET /planificaciones?centerId=X&roomId=Y&mes=YYYY-MM
router.get("/planificaciones", async (req, res) => {
  await ensureTables();
  const { centerId, roomId, mes } = req.query;
  const conditions: string[] = [];
  const params: any[] = [];
  if (centerId) { params.push(Number(centerId)); conditions.push(`p.center_id=$${params.length}`); }
  if (roomId) { params.push(Number(roomId)); conditions.push(`p.room_id=$${params.length}`); }
  if (mes) { params.push(mes); conditions.push(`p.mes=$${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT p.* FROM planificaciones p ${where} ORDER BY p.mes DESC, p.id DESC`,
    params
  );
  res.json(rows.map((r) => planToDto(r)));
});

// GET /planificaciones/:id
router.get("/planificaciones/:id", async (req, res) => {
  await ensureTables();
  const { rows } = await pool.query(`SELECT * FROM planificaciones WHERE id=$1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  const { rows: bloques } = await pool.query(
    `SELECT * FROM planificacion_bloques WHERE planificacion_id=$1 ORDER BY orden, id`,
    [req.params.id]
  );
  res.json(planToDto(rows[0], bloques));
});

// POST /planificaciones
router.post("/planificaciones", async (req, res) => {
  await ensureTables();
  const { centerId, roomId, mes, liderPedagogica, facilitadoras, observaciones } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO planificaciones (center_id, room_id, mes, lider_pedagogica, facilitadoras, observaciones)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [centerId, roomId ?? null, mes, liderPedagogica ?? null, facilitadoras ?? null, observaciones ?? null]
  );
  res.status(201).json(planToDto(rows[0], []));
});

// PUT /planificaciones/:id
router.put("/planificaciones/:id", async (req, res) => {
  await ensureTables();
  const { roomId, mes, liderPedagogica, facilitadoras, observaciones } = req.body;
  const { rows } = await pool.query(
    `UPDATE planificaciones SET room_id=$1, mes=$2, lider_pedagogica=$3, facilitadoras=$4, observaciones=$5, updated_at=NOW()
     WHERE id=$6 RETURNING *`,
    [roomId ?? null, mes, liderPedagogica ?? null, facilitadoras ?? null, observaciones ?? null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  const { rows: bloques } = await pool.query(
    `SELECT * FROM planificacion_bloques WHERE planificacion_id=$1 ORDER BY orden, id`,
    [req.params.id]
  );
  res.json(planToDto(rows[0], bloques));
});

// DELETE /planificaciones/:id
router.delete("/planificaciones/:id", async (req, res) => {
  await ensureTables();
  await pool.query(`DELETE FROM planificacion_bloques WHERE planificacion_id=$1`, [req.params.id]);
  await pool.query(`DELETE FROM planificaciones WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

// POST /planificaciones/:id/bloques
router.post("/planificaciones/:id/bloques", async (req, res) => {
  await ensureTables();
  const { nombre, actividades, materiales, inicio, desarrollo, cierre, orden } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO planificacion_bloques (planificacion_id, nombre, actividades, materiales, inicio, desarrollo, cierre, orden)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.params.id, nombre, actividades ?? null, materiales ?? null, inicio ?? null, desarrollo ?? null, cierre ?? null, orden ?? 0]
  );
  res.status(201).json(bloqueToDto(rows[0]));
});

// PUT /planificaciones/:id/bloques/:bloqueId
router.put("/planificaciones/:id/bloques/:bloqueId", async (req, res) => {
  await ensureTables();
  const { nombre, actividades, materiales, inicio, desarrollo, cierre, orden } = req.body;
  const { rows } = await pool.query(
    `UPDATE planificacion_bloques SET nombre=$1, actividades=$2, materiales=$3, inicio=$4, desarrollo=$5, cierre=$6, orden=$7
     WHERE id=$8 AND planificacion_id=$9 RETURNING *`,
    [nombre, actividades ?? null, materiales ?? null, inicio ?? null, desarrollo ?? null, cierre ?? null, orden ?? 0, req.params.bloqueId, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(bloqueToDto(rows[0]));
});

// DELETE /planificaciones/:id/bloques/:bloqueId
router.delete("/planificaciones/:id/bloques/:bloqueId", async (req, res) => {
  await ensureTables();
  await pool.query(`DELETE FROM planificacion_bloques WHERE id=$1 AND planificacion_id=$2`, [req.params.bloqueId, req.params.id]);
  res.json({ ok: true });
});

export default router;
