import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cronogramas (
      id SERIAL PRIMARY KEY,
      center_id INTEGER NOT NULL,
      room_id INTEGER,
      planificacion_id INTEGER,
      semana_inicio DATE NOT NULL,
      coach VARCHAR(200),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cronograma_filas (
      id SERIAL PRIMARY KEY,
      cronograma_id INTEGER NOT NULL,
      horario VARCHAR(10) NOT NULL,
      bloque VARCHAR(100) NOT NULL,
      tipo VARCHAR(20) DEFAULT 'pedagogico',
      lunes TEXT,
      martes TEXT,
      miercoles TEXT,
      jueves TEXT,
      viernes TEXT,
      orden INTEGER DEFAULT 0
    )
  `);
}

// Default rutina template
const RUTINA_TEMPLATE = [
  { horario: "08:30", bloque: "Inicio de jornada", tipo: "rutina", lunes: "Actividades lúdicas y saludo de bienvenida", martes: "Actividades lúdicas y saludo de bienvenida", miercoles: "Actividades lúdicas y saludo de bienvenida", jueves: "Actividades lúdicas y saludo de bienvenida", viernes: "Actividades lúdicas y saludo de bienvenida", orden: 0 },
  { horario: "09:00", bloque: "RUTINA", tipo: "rutina", lunes: "DESAYUNO", martes: "DESAYUNO", miercoles: "DESAYUNO", jueves: "DESAYUNO", viernes: "DESAYUNO", orden: 1 },
  { horario: "09:30", bloque: "RUTINA", tipo: "rutina", lunes: "Cambio de pañal.", martes: "Cambio de pañal.", miercoles: "Cambio de pañal.", jueves: "Cambio de pañal.", viernes: "Cambio de pañal.", orden: 2 },
  { horario: "10:00", bloque: "Pedagógico", tipo: "pedagogico", orden: 3 },
  { horario: "10:30", bloque: "Patio", tipo: "patio", orden: 4 },
  { horario: "11:00", bloque: "RUTINA", tipo: "rutina", lunes: "Almuerzo", martes: "Almuerzo", miercoles: "Almuerzo", jueves: "Almuerzo", viernes: "Almuerzo", orden: 5 },
  { horario: "11:20", bloque: "RUTINA", tipo: "rutina", lunes: "Cambio de pañal.", martes: "Cambio de pañal.", miercoles: "Cambio de pañal.", jueves: "Cambio de pañal.", viernes: "Cambio de pañal.", orden: 6 },
  { horario: "11:30", bloque: "RUTINA", tipo: "rutina", lunes: "DESCANSO", martes: "DESCANSO", miercoles: "DESCANSO", jueves: "DESCANSO", viernes: "DESCANSO", orden: 7 },
  { horario: "13:00", bloque: "Lúdico", tipo: "pedagogico", orden: 8 },
  { horario: "14:00", bloque: "RUTINA", tipo: "rutina", lunes: "MERIENDA", martes: "MERIENDA", miercoles: "MERIENDA", jueves: "MERIENDA", viernes: "MERIENDA", orden: 9 },
  { horario: "14:45", bloque: "RUTINA", tipo: "rutina", lunes: "Cambio de pañal.", martes: "Cambio de pañal.", miercoles: "Cambio de pañal.", jueves: "Cambio de pañal.", viernes: "Cambio de pañal.", orden: 10 },
  { horario: "15:30", bloque: "SALIDA", tipo: "salida", lunes: "SALIDA", martes: "SALIDA", miercoles: "SALIDA", jueves: "SALIDA", viernes: "SALIDA", orden: 11 },
];

function filaToDto(r: any) {
  return {
    id: r.id,
    cronogramaId: r.cronograma_id,
    horario: r.horario,
    bloque: r.bloque,
    tipo: r.tipo,
    lunes: r.lunes,
    martes: r.martes,
    miercoles: r.miercoles,
    jueves: r.jueves,
    viernes: r.viernes,
    orden: r.orden,
  };
}

function cronoToDto(r: any, filas: any[] = []) {
  return {
    id: r.id,
    centerId: r.center_id,
    roomId: r.room_id,
    planificacionId: r.planificacion_id,
    semanaInicio: r.semana_inicio instanceof Date
      ? r.semana_inicio.toISOString().slice(0, 10)
      : String(r.semana_inicio).slice(0, 10),
    coach: r.coach,
    createdAt: r.created_at,
    filas: filas.map(filaToDto),
  };
}

// GET /cronogramas-semanales?centerId=&planificacionId=
router.get("/cronogramas-semanales", async (req, res) => {
  await ensureTables();
  const centerId = req.query.centerId ?? req.auth?.centerId;
  const { planificacionId } = req.query as { planificacionId?: string };
  if (!centerId) return res.json([]);
  const conditions: string[] = ["center_id=$1"];
  const params: any[] = [centerId];
  if (planificacionId) { params.push(Number(planificacionId)); conditions.push(`planificacion_id=$${params.length}`); }
  const { rows } = await pool.query(
    `SELECT * FROM cronogramas WHERE ${conditions.join(" AND ")} ORDER BY semana_inicio DESC`,
    params
  );
  res.json(rows.map(r => cronoToDto(r)));
});

// GET /cronogramas-semanales/:id
router.get("/cronogramas-semanales/:id", async (req, res) => {
  await ensureTables();
  const { rows } = await pool.query(`SELECT * FROM cronogramas WHERE id=$1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  const { rows: filas } = await pool.query(
    `SELECT * FROM cronograma_filas WHERE cronograma_id=$1 ORDER BY orden, id`,
    [req.params.id]
  );
  res.json(cronoToDto(rows[0], filas));
});

// POST /cronogramas-semanales
router.post("/cronogramas-semanales", async (req, res) => {
  await ensureTables();
  const centerId = req.body.centerId ?? req.auth?.centerId;
  const { roomId, planificacionId, semanaInicio, coach } = req.body;
  if (!centerId || !semanaInicio) return res.status(400).json({ error: "centerId y semanaInicio requeridos" });

  const { rows } = await pool.query(
    `INSERT INTO cronogramas (center_id, room_id, planificacion_id, semana_inicio, coach)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [centerId, roomId ?? null, planificacionId ?? null, semanaInicio, coach ?? null]
  );
  const crono = rows[0];

  // Insert rutina template
  for (const fila of RUTINA_TEMPLATE) {
    await pool.query(
      `INSERT INTO cronograma_filas (cronograma_id, horario, bloque, tipo, lunes, martes, miercoles, jueves, viernes, orden)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [crono.id, fila.horario, fila.bloque, fila.tipo,
       (fila as any).lunes ?? null, (fila as any).martes ?? null,
       (fila as any).miercoles ?? null, (fila as any).jueves ?? null,
       (fila as any).viernes ?? null, fila.orden]
    );
  }

  const { rows: filas } = await pool.query(
    `SELECT * FROM cronograma_filas WHERE cronograma_id=$1 ORDER BY orden, id`,
    [crono.id]
  );
  res.status(201).json(cronoToDto(crono, filas));
});

// PUT /cronogramas-semanales/:id  — update header
router.put("/cronogramas-semanales/:id", async (req, res) => {
  await ensureTables();
  const { coach } = req.body;
  const { rows } = await pool.query(
    `UPDATE cronogramas SET coach=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [coach ?? null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(cronoToDto(rows[0]));
});

// PUT /cronogramas-semanales/:id/filas  — upsert all rows
router.put("/cronogramas-semanales/:id/filas", async (req, res) => {
  await ensureTables();
  const cronoId = parseInt(req.params.id);
  const filas: any[] = req.body;

  // Delete rows not in the list
  const keepIds = filas.filter(f => f.id).map(f => f.id);
  if (keepIds.length > 0) {
    await pool.query(
      `DELETE FROM cronograma_filas WHERE cronograma_id=$1 AND id <> ALL($2::int[])`,
      [cronoId, keepIds]
    );
  } else {
    await pool.query(`DELETE FROM cronograma_filas WHERE cronograma_id=$1`, [cronoId]);
  }

  const result = [];
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    if (f.id) {
      const { rows } = await pool.query(
        `UPDATE cronograma_filas SET horario=$1, bloque=$2, tipo=$3, lunes=$4, martes=$5,
         miercoles=$6, jueves=$7, viernes=$8, orden=$9
         WHERE id=$10 AND cronograma_id=$11 RETURNING *`,
        [f.horario, f.bloque, f.tipo, f.lunes ?? null, f.martes ?? null,
         f.miercoles ?? null, f.jueves ?? null, f.viernes ?? null, i, f.id, cronoId]
      );
      if (rows[0]) result.push(rows[0]);
    } else {
      const { rows } = await pool.query(
        `INSERT INTO cronograma_filas (cronograma_id, horario, bloque, tipo, lunes, martes, miercoles, jueves, viernes, orden)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [cronoId, f.horario, f.bloque, f.tipo, f.lunes ?? null, f.martes ?? null,
         f.miercoles ?? null, f.jueves ?? null, f.viernes ?? null, i]
      );
      if (rows[0]) result.push(rows[0]);
    }
  }
  res.json(result.map(filaToDto));
});

// POST /cronogramas-semanales/:id/reset — reinicia filas al template
router.post("/cronogramas-semanales/:id/reset", async (req, res) => {
  await ensureTables();
  const cronoId = parseInt(req.params.id);
  await pool.query(`DELETE FROM cronograma_filas WHERE cronograma_id=$1`, [cronoId]);
  for (const fila of RUTINA_TEMPLATE) {
    await pool.query(
      `INSERT INTO cronograma_filas (cronograma_id, horario, bloque, tipo, lunes, martes, miercoles, jueves, viernes, orden)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [cronoId, fila.horario, fila.bloque, fila.tipo,
       (fila as any).lunes ?? null, (fila as any).martes ?? null,
       (fila as any).miercoles ?? null, (fila as any).jueves ?? null,
       (fila as any).viernes ?? null, fila.orden]
    );
  }
  const { rows: filas } = await pool.query(
    `SELECT * FROM cronograma_filas WHERE cronograma_id=$1 ORDER BY orden, id`, [cronoId]
  );
  res.json(filas.map(filaToDto));
});

// DELETE /cronogramas-semanales/:id
router.delete("/cronogramas-semanales/:id", async (req, res) => {
  await ensureTables();
  await pool.query(`DELETE FROM cronograma_filas WHERE cronograma_id=$1`, [req.params.id]);
  await pool.query(`DELETE FROM cronogramas WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

export default router;
