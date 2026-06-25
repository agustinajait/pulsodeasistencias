import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id SERIAL PRIMARY KEY,
      center_id INTEGER NOT NULL,
      fecha DATE NOT NULL,
      tipo VARCHAR(30) NOT NULL,
      titulo VARCHAR(200),
      descripcion TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff (
      id SERIAL PRIMARY KEY,
      center_id INTEGER NOT NULL,
      nombre VARCHAR(100) NOT NULL,
      apellido VARCHAR(100) NOT NULL,
      cargo VARCHAR(100),
      sueldo_mensual NUMERIC(12,2) NOT NULL DEFAULT 0,
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ── Calendar events ────────────────────────────────────────────────────────

// GET /calendario/events?centerId=X&month=YYYY-MM
router.get("/calendario/events", async (req, res) => {
  await ensureTables();
  const { centerId, month } = req.query;
  const conditions: string[] = [];
  const params: any[] = [];
  if (centerId) { params.push(Number(centerId)); conditions.push(`center_id = $${params.length}`); }
  if (month) {
    params.push(`${month}-01`);
    conditions.push(`fecha >= $${params.length}`);
    params.push(`${month}-01`);
    conditions.push(`fecha < (DATE($${params.length}) + INTERVAL '1 month')`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(`SELECT * FROM calendar_events ${where} ORDER BY fecha, tipo`, params);
  res.json(rows.map(r => ({
    id: r.id,
    centerId: r.center_id,
    fecha: r.fecha.toISOString().slice(0, 10),
    tipo: r.tipo,
    titulo: r.titulo,
    descripcion: r.descripcion,
  })));
});

// POST /calendario/events
router.post("/calendario/events", async (req, res) => {
  await ensureTables();
  const { centerId, fecha, tipo, titulo, descripcion } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO calendar_events (center_id, fecha, tipo, titulo, descripcion)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [centerId, fecha, tipo, titulo ?? null, descripcion ?? null]
  );
  const r = rows[0];
  res.status(201).json({ id: r.id, centerId: r.center_id, fecha: r.fecha.toISOString().slice(0, 10), tipo: r.tipo, titulo: r.titulo, descripcion: r.descripcion });
});

// PUT /calendario/events/:id
router.put("/calendario/events/:id", async (req, res) => {
  await ensureTables();
  const { tipo, titulo, descripcion } = req.body;
  const { rows } = await pool.query(
    `UPDATE calendar_events SET tipo=$1, titulo=$2, descripcion=$3 WHERE id=$4 RETURNING *`,
    [tipo, titulo ?? null, descripcion ?? null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  const r = rows[0];
  res.json({ id: r.id, centerId: r.center_id, fecha: r.fecha.toISOString().slice(0, 10), tipo: r.tipo, titulo: r.titulo, descripcion: r.descripcion });
});

// DELETE /calendario/events/:id
router.delete("/calendario/events/:id", async (req, res) => {
  await ensureTables();
  await pool.query(`DELETE FROM calendar_events WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

// GET /calendario/working-days?centerId=X&month=YYYY-MM
// Returns total weekdays in the month minus feriados/vacaciones
router.get("/calendario/working-days", async (req, res) => {
  await ensureTables();
  const { centerId, month } = req.query as { centerId?: string; month?: string };
  if (!month) return res.json({ workingDays: 0, totalWeekdays: 0, nonWorkingDays: 0 });

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  // Count weekdays in month
  let totalWeekdays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow !== 0 && dow !== 6) totalWeekdays++;
  }

  // Count feriados and vacaciones on weekdays
  const params: any[] = [`${month}-01`];
  let centerFilter = "";
  if (centerId) { params.push(Number(centerId)); centerFilter = `AND center_id = $${params.length}`; }

  const { rows } = await pool.query(
    `SELECT DISTINCT fecha FROM calendar_events
     WHERE fecha >= $1 AND fecha < (DATE($1) + INTERVAL '1 month')
     AND tipo IN ('FERIADO','VACACIONES','SUSPENSION')
     ${centerFilter}`,
    params
  );

  // Only count non-working if they fall on a weekday
  let nonWorkingDays = 0;
  for (const row of rows) {
    const d = new Date(row.fecha);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) nonWorkingDays++;
  }

  res.json({ workingDays: totalWeekdays - nonWorkingDays, totalWeekdays, nonWorkingDays });
});

// ── Staff ──────────────────────────────────────────────────────────────────

// GET /calendario/staff?centerId=X
router.get("/calendario/staff", async (req, res) => {
  await ensureTables();
  const { centerId } = req.query;
  const { rows } = await pool.query(
    `SELECT * FROM staff WHERE center_id=$1 AND activo=TRUE ORDER BY apellido, nombre`,
    [Number(centerId)]
  );
  res.json(rows.map(r => ({
    id: r.id, centerId: r.center_id, nombre: r.nombre, apellido: r.apellido,
    cargo: r.cargo, sueldoMensual: parseFloat(r.sueldo_mensual), activo: r.activo,
  })));
});

// POST /calendario/staff
router.post("/calendario/staff", async (req, res) => {
  await ensureTables();
  const { centerId, nombre, apellido, cargo, sueldoMensual } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO staff (center_id, nombre, apellido, cargo, sueldo_mensual)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [centerId, nombre, apellido, cargo ?? null, sueldoMensual ?? 0]
  );
  const r = rows[0];
  res.status(201).json({ id: r.id, centerId: r.center_id, nombre: r.nombre, apellido: r.apellido, cargo: r.cargo, sueldoMensual: parseFloat(r.sueldo_mensual), activo: r.activo });
});

// PUT /calendario/staff/:id
router.put("/calendario/staff/:id", async (req, res) => {
  await ensureTables();
  const { nombre, apellido, cargo, sueldoMensual, activo } = req.body;
  const { rows } = await pool.query(
    `UPDATE staff SET nombre=$1, apellido=$2, cargo=$3, sueldo_mensual=$4, activo=$5 WHERE id=$6 RETURNING *`,
    [nombre, apellido, cargo ?? null, sueldoMensual ?? 0, activo ?? true, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  const r = rows[0];
  res.json({ id: r.id, centerId: r.center_id, nombre: r.nombre, apellido: r.apellido, cargo: r.cargo, sueldoMensual: parseFloat(r.sueldo_mensual), activo: r.activo });
});

// DELETE /calendario/staff/:id (baja lógica)
router.delete("/calendario/staff/:id", async (req, res) => {
  await ensureTables();
  await pool.query(`UPDATE staff SET activo=FALSE WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

// ── Center profile ─────────────────────────────────────────────────────────

async function ensureCenterProfile() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS center_profile (
      center_id INTEGER PRIMARY KEY,
      logo_base64 TEXT,
      direccion VARCHAR(300),
      director_nombre VARCHAR(200),
      telefono VARCHAR(80),
      email VARCHAR(200),
      descripcion TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// GET /centers/:id/profile
router.get("/centers/:id/profile", async (req, res) => {
  await ensureCenterProfile();
  const { rows } = await pool.query(`SELECT * FROM center_profile WHERE center_id=$1`, [req.params.id]);
  if (!rows[0]) return res.json({ centerId: Number(req.params.id) });
  const r = rows[0];
  res.json({
    centerId: r.center_id,
    logoBase64: r.logo_base64,
    direccion: r.direccion,
    directorNombre: r.director_nombre,
    telefono: r.telefono,
    email: r.email,
    descripcion: r.descripcion,
  });
});

// PUT /centers/:id/profile
router.put("/centers/:id/profile", async (req, res) => {
  await ensureCenterProfile();
  const { logoBase64, direccion, directorNombre, telefono, email, descripcion } = req.body;
  await pool.query(
    `INSERT INTO center_profile (center_id, logo_base64, direccion, director_nombre, telefono, email, descripcion, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
     ON CONFLICT (center_id) DO UPDATE SET
       logo_base64=EXCLUDED.logo_base64,
       direccion=EXCLUDED.direccion,
       director_nombre=EXCLUDED.director_nombre,
       telefono=EXCLUDED.telefono,
       email=EXCLUDED.email,
       descripcion=EXCLUDED.descripcion,
       updated_at=NOW()`,
    [req.params.id, logoBase64 ?? null, direccion ?? null, directorNombre ?? null, telefono ?? null, email ?? null, descripcion ?? null]
  );
  res.json({ ok: true });
});

export default router;
