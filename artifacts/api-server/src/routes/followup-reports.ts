import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS child_followup_reports (
      id SERIAL PRIMARY KEY,
      child_id INTEGER NOT NULL,
      center_id INTEGER NOT NULL,
      fecha VARCHAR(20),
      lider VARCHAR(200),
      facilitadora VARCHAR(200),
      eco_number INTEGER,
      dni_nino VARCHAR(30),
      fecha_nac_nino VARCHAR(30),
      adult_nombre VARCHAR(200),
      adult_dni VARCHAR(30),
      body_text TEXT,
      firmante_nombre VARCHAR(200),
      firmante_titulo VARCHAR(200),
      firmante_matricula VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// GET /followup-reports?centerId=X&childId=Y
router.get("/followup-reports", async (req, res) => {
  try {
    await ensureTable();
    const conditions: string[] = [];
    const params: any[] = [];
    if (req.query.centerId) { params.push(Number(req.query.centerId)); conditions.push(`f.center_id = $${params.length}`); }
    if (req.query.childId) { params.push(Number(req.query.childId)); conditions.push(`f.child_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT f.id, f.child_id AS "childId", f.center_id AS "centerId",
              ch.nombre, ch.apellido, f.fecha, f.lider, f.facilitadora, f.eco_number AS "ecoNumber",
              f.dni_nino AS "dniNino", f.fecha_nac_nino AS "fechaNacNino",
              f.adult_nombre AS "adultNombre", f.adult_dni AS "adultDni",
              f.body_text AS "bodyText",
              f.firmante_nombre AS "firmanteNombre", f.firmante_titulo AS "firmanteTitulo",
              f.firmante_matricula AS "firmanteMatricula",
              f.created_at AS "createdAt", f.updated_at AS "updatedAt"
       FROM child_followup_reports f
       JOIN children ch ON ch.id = f.child_id
       ${where}
       ORDER BY f.fecha DESC, f.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err: any) {
    req.log.error(err, "Error listing followup reports");
    res.status(500).json({ error: "Internal server error", detail: err?.message });
  }
});

// POST /followup-reports
router.post("/followup-reports", async (req, res) => {
  try {
    await ensureTable();
    const { childId, centerId, fecha, lider, facilitadora, ecoNumber, dniNino, fechaNacNino, adultNombre, adultDni, bodyText, firmanteNombre, firmanteTitulo, firmanteMatricula } = req.body;
    if (!childId || !centerId) { res.status(400).json({ error: "childId and centerId are required" }); return; }
    const { rows } = await pool.query(
      `INSERT INTO child_followup_reports (child_id, center_id, fecha, lider, facilitadora, eco_number, dni_nino, fecha_nac_nino, adult_nombre, adult_dni, body_text, firmante_nombre, firmante_titulo, firmante_matricula)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id, child_id AS "childId", center_id AS "centerId", fecha, lider, facilitadora, eco_number AS "ecoNumber", dni_nino AS "dniNino", fecha_nac_nino AS "fechaNacNino", adult_nombre AS "adultNombre", adult_dni AS "adultDni", body_text AS "bodyText", firmante_nombre AS "firmanteNombre", firmante_titulo AS "firmanteTitulo", firmante_matricula AS "firmanteMatricula", created_at AS "createdAt"`,
      [childId, centerId, fecha ?? null, lider ?? null, facilitadora ?? null, ecoNumber ?? null, dniNino ?? null, fechaNacNino ?? null, adultNombre ?? null, adultDni ?? null, bodyText ?? null, firmanteNombre ?? null, firmanteTitulo ?? null, firmanteMatricula ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    req.log.error(err, "Error creating followup report");
    res.status(500).json({ error: "Internal server error", detail: err?.message });
  }
});

// PUT /followup-reports/:id
router.put("/followup-reports/:id", async (req, res) => {
  try {
    await ensureTable();
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { fecha, lider, facilitadora, ecoNumber, dniNino, fechaNacNino, adultNombre, adultDni, bodyText, firmanteNombre, firmanteTitulo, firmanteMatricula } = req.body;
    const { rows } = await pool.query(
      `UPDATE child_followup_reports
       SET fecha=$2, lider=$3, facilitadora=$4, eco_number=$5, dni_nino=$6, fecha_nac_nino=$7,
           adult_nombre=$8, adult_dni=$9, body_text=$10, firmante_nombre=$11, firmante_titulo=$12,
           firmante_matricula=$13, updated_at=NOW()
       WHERE id=$1
       RETURNING id, child_id AS "childId", center_id AS "centerId", fecha, lider, facilitadora, eco_number AS "ecoNumber", dni_nino AS "dniNino", fecha_nac_nino AS "fechaNacNino", adult_nombre AS "adultNombre", adult_dni AS "adultDni", body_text AS "bodyText", firmante_nombre AS "firmanteNombre", firmante_titulo AS "firmanteTitulo", firmante_matricula AS "firmanteMatricula", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, fecha ?? null, lider ?? null, facilitadora ?? null, ecoNumber ?? null, dniNino ?? null, fechaNacNino ?? null, adultNombre ?? null, adultDni ?? null, bodyText ?? null, firmanteNombre ?? null, firmanteTitulo ?? null, firmanteMatricula ?? null]
    );
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch (err: any) {
    req.log.error(err, "Error updating followup report");
    res.status(500).json({ error: "Internal server error", detail: err?.message });
  }
});

// DELETE /followup-reports/:id
router.delete("/followup-reports/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    await pool.query(`DELETE FROM child_followup_reports WHERE id=$1`, [id]);
    res.json({ status: "deleted" });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error", detail: err?.message });
  }
});

export default router;
