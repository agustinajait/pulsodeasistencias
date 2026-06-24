import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cases (
      id SERIAL PRIMARY KEY,
      child_id INTEGER NOT NULL,
      center_id INTEGER NOT NULL,
      ivs_base INTEGER,
      ivs_potencial INTEGER,
      referente_nombre VARCHAR(200),
      referente_vinculo VARCHAR(100),
      referente_telefono VARCHAR(50),
      situacion_resumen TEXT,
      tipos_problematica JSONB NOT NULL DEFAULT '[]',
      organismos TEXT,
      tiene_cud BOOLEAN DEFAULT FALSE,
      cud_pendiente BOOLEAN DEFAULT FALSE,
      acompaniamiento_previo BOOLEAN DEFAULT FALSE,
      estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS case_novedades (
      id SERIAL PRIMARY KEY,
      case_id INTEGER NOT NULL,
      fecha DATE NOT NULL,
      descripcion TEXT NOT NULL,
      acuerdos TEXT,
      organismo VARCHAR(200),
      registrado_por VARCHAR(200),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

function toCamel(row: any) {
  return {
    id: row.id,
    childId: row.child_id,
    centerId: row.center_id,
    ivsBase: row.ivs_base,
    ivsPotencial: row.ivs_potencial,
    referenteNombre: row.referente_nombre,
    referenteVinculo: row.referente_vinculo,
    referenteTelefono: row.referente_telefono,
    situacionResumen: row.situacion_resumen,
    tiposProblematica: row.tipos_problematica ?? [],
    organismos: row.organismos,
    tieneCud: row.tiene_cud,
    cudPendiente: row.cud_pendiente,
    acompaniamientoPrevio: row.acompaniamiento_previo,
    estado: row.estado,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

function novedadToCamel(row: any) {
  return {
    id: row.id,
    caseId: row.case_id,
    fecha: row.fecha,
    descripcion: row.descripcion,
    acuerdos: row.acuerdos,
    organismo: row.organismo,
    registradoPor: row.registrado_por,
    createdAt: row.created_at,
  };
}

// GET /cases
router.get("/cases", async (req, res) => {
  await ensureTables();
  const { centerId, childId, estado } = req.query;
  const conditions: string[] = [];
  const params: any[] = [];
  if (centerId) { params.push(Number(centerId)); conditions.push(`center_id = $${params.length}`); }
  if (childId) { params.push(Number(childId)); conditions.push(`child_id = $${params.length}`); }
  if (estado) { params.push(estado); conditions.push(`estado = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT c.*, COALESCE(json_agg(n ORDER BY n.fecha DESC) FILTER (WHERE n.id IS NOT NULL), '[]') AS novedades
     FROM cases c
     LEFT JOIN case_novedades n ON n.case_id = c.id
     ${where}
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    params
  );
  res.json(rows.map((r) => ({ ...toCamel(r), novedades: (r.novedades ?? []).map(novedadToCamel) })));
});

// GET /cases/:id
router.get("/cases/:id", async (req, res) => {
  await ensureTables();
  const { rows } = await pool.query(
    `SELECT c.*, COALESCE(json_agg(n ORDER BY n.fecha DESC) FILTER (WHERE n.id IS NOT NULL), '[]') AS novedades
     FROM cases c
     LEFT JOIN case_novedades n ON n.case_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  const r = rows[0];
  res.json({ ...toCamel(r), novedades: (r.novedades ?? []).map(novedadToCamel) });
});

// POST /cases
router.post("/cases", async (req, res) => {
  await ensureTables();
  const {
    childId, centerId, ivsBase, ivsPotencial,
    referenteNombre, referenteVinculo, referenteTelefono,
    situacionResumen, tiposProblematica, organismos,
    tieneCud, cudPendiente, acompaniamientoPrevio, estado,
  } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO cases (child_id, center_id, ivs_base, ivs_potencial, referente_nombre, referente_vinculo,
      referente_telefono, situacion_resumen, tipos_problematica, organismos, tiene_cud, cud_pendiente,
      acompaniamiento_previo, estado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      childId, centerId, ivsBase ?? null, ivsPotencial ?? null,
      referenteNombre ?? null, referenteVinculo ?? null, referenteTelefono ?? null,
      situacionResumen ?? null, JSON.stringify(tiposProblematica ?? []), organismos ?? null,
      tieneCud ?? false, cudPendiente ?? false, acompaniamientoPrevio ?? false,
      estado ?? "ABIERTO",
    ]
  );
  res.status(201).json({ ...toCamel(rows[0]), novedades: [] });
});

// PUT /cases/:id
router.put("/cases/:id", async (req, res) => {
  await ensureTables();
  const {
    ivsBase, ivsPotencial, referenteNombre, referenteVinculo, referenteTelefono,
    situacionResumen, tiposProblematica, organismos, tieneCud, cudPendiente,
    acompaniamientoPrevio, estado,
  } = req.body;
  const closedAt = estado === "CERRADO" ? "NOW()" : "NULL";
  const { rows } = await pool.query(
    `UPDATE cases SET
      ivs_base=$1, ivs_potencial=$2, referente_nombre=$3, referente_vinculo=$4,
      referente_telefono=$5, situacion_resumen=$6, tipos_problematica=$7, organismos=$8,
      tiene_cud=$9, cud_pendiente=$10, acompaniamiento_previo=$11, estado=$12,
      updated_at=NOW(), closed_at=${closedAt}
     WHERE id=$13 RETURNING *`,
    [
      ivsBase ?? null, ivsPotencial ?? null, referenteNombre ?? null, referenteVinculo ?? null,
      referenteTelefono ?? null, situacionResumen ?? null, JSON.stringify(tiposProblematica ?? []),
      organismos ?? null, tieneCud ?? false, cudPendiente ?? false, acompaniamientoPrevio ?? false,
      estado ?? "ABIERTO", req.params.id,
    ]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  // fetch novedades
  const nov = await pool.query(`SELECT * FROM case_novedades WHERE case_id=$1 ORDER BY fecha DESC`, [req.params.id]);
  res.json({ ...toCamel(rows[0]), novedades: nov.rows.map(novedadToCamel) });
});

// DELETE /cases/:id
router.delete("/cases/:id", async (req, res) => {
  await ensureTables();
  await pool.query(`DELETE FROM case_novedades WHERE case_id=$1`, [req.params.id]);
  await pool.query(`DELETE FROM cases WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

// POST /cases/:id/novedades
router.post("/cases/:id/novedades", async (req, res) => {
  await ensureTables();
  const { fecha, descripcion, acuerdos, organismo, registradoPor } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO case_novedades (case_id, fecha, descripcion, acuerdos, organismo, registrado_por)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.params.id, fecha, descripcion, acuerdos ?? null, organismo ?? null, registradoPor ?? null]
  );
  // bump updated_at on case
  await pool.query(`UPDATE cases SET updated_at=NOW() WHERE id=$1`, [req.params.id]);
  res.status(201).json(novedadToCamel(rows[0]));
});

// DELETE /cases/:id/novedades/:novedadId
router.delete("/cases/:id/novedades/:novedadId", async (req, res) => {
  await ensureTables();
  await pool.query(`DELETE FROM case_novedades WHERE id=$1 AND case_id=$2`, [req.params.novedadId, req.params.id]);
  res.json({ ok: true });
});

export default router;
