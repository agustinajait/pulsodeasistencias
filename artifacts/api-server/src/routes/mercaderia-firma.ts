import { Router } from "express";
import { pool, db, childrenTable, attendanceTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";

const router = Router();

async function ensureColumns() {
  await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS mercaderia_token VARCHAR(64)`);
  await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS mercaderia_firmante_nombre VARCHAR(200)`);
  await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS mercaderia_firma_base64 TEXT`);
  await pool.query(`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS mercaderia_firmado_at TIMESTAMPTZ`);
  await pool.query(`CREATE INDEX IF NOT EXISTS attendance_mercaderia_token_idx ON attendance(mercaderia_token)`);
}

// POST /mercaderia/solicitar-firma  { childId, fecha }
// Genera token, devuelve URL de firma y link de WhatsApp
router.post("/mercaderia/solicitar-firma", async (req, res) => {
  try {
    await ensureColumns();
    const { childId, fecha } = req.body;
    if (!childId || !fecha) {
      res.status(400).json({ error: "childId and fecha required" });
      return;
    }

    const token = randomBytes(32).toString("hex");

    // Upsert attendance con el token
    const existing = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.childId, Number(childId)), eq(attendanceTable.fecha, fecha)))
      .limit(1);

    if (existing.length > 0) {
      await pool.query(
        `UPDATE attendance SET mercaderia_token=$1, mercaderia=TRUE WHERE child_id=$2 AND fecha=$3`,
        [token, Number(childId), fecha]
      );
    } else {
      await pool.query(
        `INSERT INTO attendance (child_id, fecha, mercaderia, mercaderia_token) VALUES ($1,$2,TRUE,$3)`,
        [Number(childId), fecha, token]
      );
    }

    // Obtener datos del niño para el mensaje de WhatsApp
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, Number(childId)));
    if (!child) {
      res.status(404).json({ error: "Child not found" });
      return;
    }

    const baseUrl = req.headers.origin || `https://${req.headers.host}`;
    const firmaUrl = `${baseUrl}/firma-mercaderia/${token}`;

    // Número de WhatsApp: Argentina 549 + número sin 0 ni 15
    let waNumber: string | null = null;
    if (child.celular) {
      const digits = child.celular.replace(/\D/g, "");
      // Si ya tiene 549... lo usamos, si empieza con 0 lo quitamos
      if (digits.startsWith("549")) waNumber = digits;
      else if (digits.startsWith("54")) waNumber = digits;
      else if (digits.startsWith("0")) waNumber = `549${digits.slice(1)}`;
      else waNumber = `549${digits}`;
    }

    const nombreFam = [child.famNombre, child.famApellido].filter(Boolean).join(" ") || "familia";
    const nombreNino = `${child.nombre} ${child.apellido}`;
    const fechaFmt = new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

    const mensaje = `Hola ${nombreFam}! Para confirmar el retiro del bolsón de mercadería de ${nombreNino} (${fechaFmt}), por favor firmá acá: ${firmaUrl}`;
    const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(mensaje)}` : null;

    res.json({ token, firmaUrl, waUrl, celular: child.celular, nombreFam, nombreNino });
  } catch (err) {
    req.log.error(err, "Error solicitando firma mercadería");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /mercaderia/firma/:token — datos públicos para la página de firma
router.get("/mercaderia/firma/:token", async (req, res) => {
  try {
    await ensureColumns();
    const { rows } = await pool.query(
      `SELECT a.id, a.child_id, a.fecha, a.mercaderia_firmante_nombre, a.mercaderia_firma_base64, a.mercaderia_firmado_at,
              c.nombre, c.apellido, c.fam_nombre AS "famNombre", c.fam_apellido AS "famApellido"
       FROM attendance a
       JOIN children c ON c.id = a.child_id
       WHERE a.mercaderia_token = $1`,
      [req.params.token]
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Link inválido o expirado" });
      return;
    }
    const r = rows[0];
    res.json({
      childId: r.child_id,
      fecha: r.fecha.toISOString().slice(0, 10),
      childNombre: r.nombre,
      childApellido: r.apellido,
      famNombre: r.famNombre,
      famApellido: r.famApellido,
      firmado: !!r.mercaderia_firmado_at,
      firmadoAt: r.mercaderia_firmado_at,
      firmanteNombre: r.mercaderia_firmante_nombre,
    });
  } catch (err) {
    req.log.error(err, "Error obteniendo datos de firma");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /mercaderia/firma/:token  { firmanteNombre, firmaBase64 }
router.post("/mercaderia/firma/:token", async (req, res) => {
  try {
    await ensureColumns();
    const { firmanteNombre, firmaBase64 } = req.body;
    if (!firmanteNombre?.trim() || !firmaBase64) {
      res.status(400).json({ error: "firmanteNombre y firmaBase64 son requeridos" });
      return;
    }
    const { rowCount } = await pool.query(
      `UPDATE attendance
       SET mercaderia_firmante_nombre=$1, mercaderia_firma_base64=$2, mercaderia_firmado_at=NOW()
       WHERE mercaderia_token=$3 AND mercaderia_firmado_at IS NULL`,
      [firmanteNombre.trim(), firmaBase64, req.params.token]
    );
    if (rowCount === 0) {
      res.status(409).json({ error: "Ya fue firmado o link inválido" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Error guardando firma mercadería");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /mercaderia/estado/:childId/:fecha — estado de firma para la UI de sala
router.get("/mercaderia/estado/:childId/:fecha", async (req, res) => {
  try {
    await ensureColumns();
    const { rows } = await pool.query(
      `SELECT mercaderia_token, mercaderia_firmante_nombre, mercaderia_firma_base64, mercaderia_firmado_at
       FROM attendance WHERE child_id=$1 AND fecha=$2`,
      [Number(req.params.childId), req.params.fecha]
    );
    if (!rows[0]) { res.json({ hasToken: false, firmado: false }); return; }
    const r = rows[0];
    res.json({
      hasToken: !!r.mercaderia_token,
      firmado: !!r.mercaderia_firmado_at,
      firmadoAt: r.mercaderia_firmado_at,
      firmanteNombre: r.mercaderia_firmante_nombre,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
