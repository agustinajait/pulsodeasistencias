import { Router } from "express";
import { pool } from "@workspace/db";
import { db, childrenTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const childAuthorizationsRouter = Router();

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS child_authorizations (
      id SERIAL PRIMARY KEY,
      child_id INTEGER NOT NULL,
      tipo VARCHAR(20) NOT NULL,
      accepted_at TIMESTAMPTZ DEFAULT NOW(),
      accepted_by_name VARCHAR(200),
      accepted_by_dni VARCHAR(30),
      accepted_by_vinculo VARCHAR(100),
      ip_address VARCHAR(60),
      data JSONB NOT NULL DEFAULT '{}',
      UNIQUE(child_id, tipo)
    )
  `);
}

ensureTable().catch(console.error);

// GET /child-authorizations/:token — returns both authorizations status for the child
childAuthorizationsRouter.get("/:token", async (req, res) => {
  try {
    const child = await db.query.childrenTable.findFirst({
      where: eq(childrenTable.docsToken, req.params.token),
    });
    if (!child) { res.status(404).json({ error: "Enlace no válido" }); return; }

    const { rows } = await pool.query(
      "SELECT tipo, accepted_at, accepted_by_name, accepted_by_dni, accepted_by_vinculo, data FROM child_authorizations WHERE child_id = $1",
      [child.id]
    );

    res.json({ childId: child.id, authorizations: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /child-authorizations/:token/retiro — save retiro authorization
// Body: { accepted_by_name, accepted_by_dni, accepted_by_vinculo, authorized_persons: [{nombre,dni,telefono}], emergency_contacts: [{nombre,telefono}] }
childAuthorizationsRouter.post("/:token/retiro", async (req, res) => {
  try {
    const child = await db.query.childrenTable.findFirst({
      where: eq(childrenTable.docsToken, req.params.token),
    });
    if (!child) { res.status(404).json({ error: "Enlace no válido" }); return; }

    const { accepted_by_name, accepted_by_dni, accepted_by_vinculo, authorized_persons, emergency_contacts } = req.body;

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? null;

    await pool.query(
      `INSERT INTO child_authorizations (child_id, tipo, accepted_by_name, accepted_by_dni, accepted_by_vinculo, ip_address, data)
       VALUES ($1, 'RETIRO', $2, $3, $4, $5, $6)
       ON CONFLICT (child_id, tipo) DO UPDATE SET
         accepted_at = NOW(),
         accepted_by_name = EXCLUDED.accepted_by_name,
         accepted_by_dni = EXCLUDED.accepted_by_dni,
         accepted_by_vinculo = EXCLUDED.accepted_by_vinculo,
         ip_address = EXCLUDED.ip_address,
         data = EXCLUDED.data`,
      [
        child.id,
        accepted_by_name ?? null,
        accepted_by_dni ?? null,
        accepted_by_vinculo ?? null,
        ip,
        JSON.stringify({ authorized_persons: authorized_persons ?? [], emergency_contacts: emergency_contacts ?? [] }),
      ]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /child-authorizations/:token/higiene — save higiene/fotos authorization
// Body: { accepted_by_name, accepted_by_dni, accepted_by_vinculo, fotos: bool, higiene: bool, simulacro: bool }
childAuthorizationsRouter.post("/:token/higiene", async (req, res) => {
  try {
    const child = await db.query.childrenTable.findFirst({
      where: eq(childrenTable.docsToken, req.params.token),
    });
    if (!child) { res.status(404).json({ error: "Enlace no válido" }); return; }

    const { accepted_by_name, accepted_by_dni, accepted_by_vinculo, fotos, higiene, simulacro } = req.body;

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? null;

    await pool.query(
      `INSERT INTO child_authorizations (child_id, tipo, accepted_by_name, accepted_by_dni, accepted_by_vinculo, ip_address, data)
       VALUES ($1, 'HIGIENE', $2, $3, $4, $5, $6)
       ON CONFLICT (child_id, tipo) DO UPDATE SET
         accepted_at = NOW(),
         accepted_by_name = EXCLUDED.accepted_by_name,
         accepted_by_dni = EXCLUDED.accepted_by_dni,
         accepted_by_vinculo = EXCLUDED.accepted_by_vinculo,
         ip_address = EXCLUDED.ip_address,
         data = EXCLUDED.data`,
      [
        child.id,
        accepted_by_name ?? null,
        accepted_by_dni ?? null,
        accepted_by_vinculo ?? null,
        ip,
        JSON.stringify({ fotos: fotos ?? false, higiene: higiene ?? false, simulacro: simulacro ?? false }),
      ]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
});
