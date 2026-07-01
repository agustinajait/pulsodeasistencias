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
      hora VARCHAR(5),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS hora VARCHAR(5)`);
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

// ── Academic calendar seed ─────────────────────────────────────────────────

type SeedEvent = { fecha: string; tipo: string; titulo: string };

// Feriados nacionales 2026 Argentina + CAIPLI institutional events
const SEED_EVENTS_2026: SeedEvent[] = [
  // ── Feriados nacionales ──────────────────────────────────────────────────
  { fecha: "2026-01-01", tipo: "FERIADO", titulo: "Año Nuevo" },
  { fecha: "2026-02-16", tipo: "FERIADO", titulo: "Carnaval" },
  { fecha: "2026-02-17", tipo: "FERIADO", titulo: "Carnaval" },
  { fecha: "2026-03-24", tipo: "FERIADO", titulo: "Día de la Memoria" },
  { fecha: "2026-04-02", tipo: "FERIADO", titulo: "Día del Veterano de Malvinas" },
  { fecha: "2026-04-03", tipo: "FERIADO", titulo: "Viernes Santo" },
  { fecha: "2026-05-01", tipo: "FERIADO", titulo: "Día del Trabajador" },
  { fecha: "2026-05-25", tipo: "FERIADO", titulo: "Revolución de Mayo" },
  { fecha: "2026-06-19", tipo: "FERIADO", titulo: "Paso a la Inmortalidad del Gral. Güemes (puente)" },
  { fecha: "2026-06-20", tipo: "FERIADO", titulo: "Día de la Bandera" },
  { fecha: "2026-07-09", tipo: "FERIADO", titulo: "Día de la Independencia" },
  { fecha: "2026-08-17", tipo: "FERIADO", titulo: "Paso a la Inmortalidad del Gral. San Martín" },
  { fecha: "2026-10-12", tipo: "FERIADO", titulo: "Día del Respeto a la Diversidad Cultural" },
  { fecha: "2026-11-20", tipo: "FERIADO", titulo: "Día de la Soberanía Nacional" },
  { fecha: "2026-12-08", tipo: "FERIADO", titulo: "Inmaculada Concepción de María" },
  { fecha: "2026-12-25", tipo: "FERIADO", titulo: "Navidad" },
  // ── Período de adaptación ────────────────────────────────────────────────
  { fecha: "2026-02-09", tipo: "CAPACITACION", titulo: "Reunión informativa con familias" },
  { fecha: "2026-02-10", tipo: "CAPACITACION", titulo: "Reunión informativa con familias" },
  { fecha: "2026-02-19", tipo: "CAPACITACION", titulo: "Reunión informativa con familias (Grupo 1)" },
  { fecha: "2026-02-20", tipo: "CAPACITACION", titulo: "Reunión informativa con familias (Grupo 2)" },
  { fecha: "2026-02-23", tipo: "CAPACITACION", titulo: "Período de adaptación" },
  { fecha: "2026-02-24", tipo: "CAPACITACION", titulo: "Período de adaptación" },
  { fecha: "2026-02-25", tipo: "CAPACITACION", titulo: "Período de adaptación" },
  { fecha: "2026-02-26", tipo: "CAPACITACION", titulo: "Período de adaptación" },
  { fecha: "2026-02-27", tipo: "CAPACITACION", titulo: "Período de adaptación" },
  // ── Diagnósticos ─────────────────────────────────────────────────────────
  { fecha: "2026-03-02", tipo: "CAPACITACION", titulo: "Diagnóstico Social, Pedagógico y Nutricional" },
  { fecha: "2026-03-03", tipo: "CAPACITACION", titulo: "Diagnóstico Social, Pedagógico y Nutricional" },
  { fecha: "2026-03-04", tipo: "CAPACITACION", titulo: "Diagnóstico Social, Pedagógico y Nutricional" },
  { fecha: "2026-03-05", tipo: "CAPACITACION", titulo: "Diagnóstico Social, Pedagógico y Nutricional" },
  { fecha: "2026-03-06", tipo: "CAPACITACION", titulo: "Diagnóstico Social, Pedagógico y Nutricional" },
  // ── Rabbit Week ──────────────────────────────────────────────────────────
  { fecha: "2026-03-30", tipo: "SUPERVISION", titulo: "Rabbit Week" },
  { fecha: "2026-03-31", tipo: "SUPERVISION", titulo: "Rabbit Week" },
  // ── Día de los jardines ──────────────────────────────────────────────────
  { fecha: "2026-05-28", tipo: "SUPERVISION", titulo: "Día de los Jardines de Infantes" },
  { fecha: "2026-05-29", tipo: "SUPERVISION", titulo: "Festejo Día de los Jardines (media jornada)" },
  // ── Receso invernal / CAIPLI TOUR ────────────────────────────────────────
  { fecha: "2026-07-13", tipo: "SUPERVISION", titulo: "CAIPLI TOUR" },
  { fecha: "2026-07-14", tipo: "SUPERVISION", titulo: "CAIPLI TOUR" },
  { fecha: "2026-07-15", tipo: "SUPERVISION", titulo: "CAIPLI TOUR" },
  { fecha: "2026-07-16", tipo: "SUPERVISION", titulo: "CAIPLI TOUR" },
  { fecha: "2026-07-17", tipo: "SUPERVISION", titulo: "Reunión entrega de informes / CAIPLI TOUR" },
  { fecha: "2026-07-20", tipo: "VACACIONES", titulo: "Receso invernal" },
  { fecha: "2026-07-21", tipo: "VACACIONES", titulo: "Receso invernal" },
  { fecha: "2026-07-22", tipo: "VACACIONES", titulo: "Receso invernal" },
  { fecha: "2026-07-23", tipo: "VACACIONES", titulo: "Receso invernal" },
  { fecha: "2026-07-24", tipo: "VACACIONES", titulo: "Receso invernal" },
  { fecha: "2026-07-27", tipo: "VACACIONES", titulo: "Receso invernal" },
  { fecha: "2026-07-28", tipo: "VACACIONES", titulo: "Receso invernal" },
  { fecha: "2026-07-29", tipo: "VACACIONES", titulo: "Receso invernal" },
  { fecha: "2026-07-30", tipo: "VACACIONES", titulo: "Receso invernal" },
  { fecha: "2026-07-31", tipo: "VACACIONES", titulo: "Receso invernal" },
  // ── Semana de la niñez ───────────────────────────────────────────────────
  { fecha: "2026-08-10", tipo: "SUPERVISION", titulo: "Semana de la Niñez" },
  { fecha: "2026-08-11", tipo: "SUPERVISION", titulo: "Semana de la Niñez" },
  { fecha: "2026-08-12", tipo: "SUPERVISION", titulo: "Semana de la Niñez" },
  { fecha: "2026-08-13", tipo: "SUPERVISION", titulo: "Semana de la Niñez" },
  { fecha: "2026-08-14", tipo: "SUPERVISION", titulo: "Semana de la Niñez" },
  // ── Día del maestro ──────────────────────────────────────────────────────
  { fecha: "2026-09-11", tipo: "FERIADO", titulo: "Día del Maestro" },
  // ── Sport Week ───────────────────────────────────────────────────────────
  { fecha: "2026-09-07", tipo: "SUPERVISION", titulo: "Sport Week" },
  { fecha: "2026-09-08", tipo: "SUPERVISION", titulo: "Sport Week" },
  { fecha: "2026-09-09", tipo: "SUPERVISION", titulo: "Sport Week" },
  { fecha: "2026-09-10", tipo: "SUPERVISION", titulo: "Sport Week" },
  // ── Semana de lectura ────────────────────────────────────────────────────
  { fecha: "2026-10-19", tipo: "SUPERVISION", titulo: "Semana de Lectura" },
  { fecha: "2026-10-20", tipo: "SUPERVISION", titulo: "Semana de Lectura" },
  { fecha: "2026-10-21", tipo: "SUPERVISION", titulo: "Semana de Lectura" },
  { fecha: "2026-10-22", tipo: "SUPERVISION", titulo: "Semana de Lectura" },
  { fecha: "2026-10-23", tipo: "SUPERVISION", titulo: "Semana de Lectura" },
  // ── Reuniones entrega informes (noviembre) ───────────────────────────────
  { fecha: "2026-11-23", tipo: "SUPERVISION", titulo: "Reunión con familias — Entrega de informes" },
  { fecha: "2026-11-24", tipo: "SUPERVISION", titulo: "Reunión con familias — Entrega de informes" },
  { fecha: "2026-11-25", tipo: "SUPERVISION", titulo: "Reunión con familias — Entrega de informes" },
  { fecha: "2026-11-26", tipo: "SUPERVISION", titulo: "Reunión con familias — Entrega de informes" },
  { fecha: "2026-11-27", tipo: "SUPERVISION", titulo: "Reunión con familias — Entrega de informes" },
  // ── Egresos y CAIPLIADAS ─────────────────────────────────────────────────
  { fecha: "2026-12-01", tipo: "SUPERVISION", titulo: "EGRESOS" },
  { fecha: "2026-12-02", tipo: "SUPERVISION", titulo: "EGRESOS" },
  { fecha: "2026-12-03", tipo: "SUPERVISION", titulo: "EGRESOS" },
  { fecha: "2026-12-04", tipo: "SUPERVISION", titulo: "EGRESOS" },
  { fecha: "2026-12-07", tipo: "SUPERVISION", titulo: "CAIPLIADAS" },
  { fecha: "2026-12-08", tipo: "SUPERVISION", titulo: "CAIPLIADAS" },
  { fecha: "2026-12-09", tipo: "SUPERVISION", titulo: "CAIPLIADAS" },
  { fecha: "2026-12-10", tipo: "SUPERVISION", titulo: "CAIPLIADAS" },
  { fecha: "2026-12-11", tipo: "SUPERVISION", titulo: "CAIPLIADAS" },
  { fecha: "2026-12-14", tipo: "SUPERVISION", titulo: "CAIPLIADAS" },
  { fecha: "2026-12-15", tipo: "SUPERVISION", titulo: "CAIPLIADAS" },
  { fecha: "2026-12-16", tipo: "SUPERVISION", titulo: "CAIPLIADAS" },
  { fecha: "2026-12-17", tipo: "SUPERVISION", titulo: "CAIPLIADAS" },
  { fecha: "2026-12-18", tipo: "SUPERVISION", titulo: "CAIPLIADAS" },
];

// POST /calendario/seed-2026  { centerId }
router.post("/calendario/seed-2026", async (req, res) => {
  try {
    await ensureTables();
    const { centerId } = req.body;
    if (!centerId) { res.status(400).json({ error: "centerId required" }); return; }

    // Delete existing 2026 events for this center to avoid duplicates on re-seed
    await pool.query(
      `DELETE FROM calendar_events WHERE center_id=$1 AND fecha >= '2026-01-01' AND fecha <= '2026-12-31'`,
      [centerId]
    );

    for (const ev of SEED_EVENTS_2026) {
      await pool.query(
        `INSERT INTO calendar_events (center_id, fecha, tipo, titulo) VALUES ($1,$2,$3,$4)`,
        [centerId, ev.fecha, ev.tipo, ev.titulo]
      );
    }

    res.json({ inserted: SEED_EVENTS_2026.length });
  } catch (err: any) {
    req.log.error(err, "Error seeding calendar");
    res.status(500).json({ error: "Internal server error", detail: err?.message });
  }
});

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
    hora: r.hora,
  })));
});

// POST /calendario/events
router.post("/calendario/events", async (req, res) => {
  await ensureTables();
  const { centerId, fecha, tipo, titulo, descripcion, hora } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO calendar_events (center_id, fecha, tipo, titulo, descripcion, hora)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [centerId, fecha, tipo, titulo ?? null, descripcion ?? null, hora ?? null]
  );
  const r = rows[0];
  res.status(201).json({ id: r.id, centerId: r.center_id, fecha: r.fecha.toISOString().slice(0, 10), tipo: r.tipo, titulo: r.titulo, descripcion: r.descripcion, hora: r.hora });
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
      coordinador_nombre VARCHAR(200),
      telefono VARCHAR(80),
      email VARCHAR(200),
      descripcion TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE center_profile ADD COLUMN IF NOT EXISTS coordinador_nombre VARCHAR(200)`);
  await pool.query(`ALTER TABLE center_profile ADD COLUMN IF NOT EXISTS report_periods JSONB DEFAULT '[]'`);
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
    coordinadorNombre: r.coordinador_nombre,
    telefono: r.telefono,
    email: r.email,
    descripcion: r.descripcion,
    reportPeriods: r.report_periods ?? [],
  });
});

// PUT /centers/:id/profile
router.put("/centers/:id/profile", async (req, res) => {
  await ensureCenterProfile();
  const { logoBase64, direccion, directorNombre, coordinadorNombre, telefono, email, descripcion, reportPeriods } = req.body;
  await pool.query(
    `INSERT INTO center_profile (center_id, logo_base64, direccion, director_nombre, coordinador_nombre, telefono, email, descripcion, report_periods, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (center_id) DO UPDATE SET
       logo_base64=EXCLUDED.logo_base64,
       direccion=EXCLUDED.direccion,
       director_nombre=EXCLUDED.director_nombre,
       coordinador_nombre=EXCLUDED.coordinador_nombre,
       telefono=EXCLUDED.telefono,
       email=EXCLUDED.email,
       descripcion=EXCLUDED.descripcion,
       report_periods=EXCLUDED.report_periods,
       updated_at=NOW()`,
    [req.params.id, logoBase64 ?? null, direccion ?? null, directorNombre ?? null, coordinadorNombre ?? null, telefono ?? null, email ?? null, descripcion ?? null, JSON.stringify(reportPeriods ?? [])]
  );
  res.json({ ok: true });
});

export default router;
