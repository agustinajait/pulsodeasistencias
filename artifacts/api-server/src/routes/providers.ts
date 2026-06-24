import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS providers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      service_types JSONB NOT NULL DEFAULT '[]',
      contact_person VARCHAR(200),
      phone VARCHAR(50),
      email VARCHAR(200),
      address TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// GET /providers?q=search
router.get("/providers", async (req, res) => {
  try {
    await ensureTable();
    const q = (req.query.q as string) ?? "";
    let result;
    if (q.trim()) {
      result = await pool.query(
        `SELECT
           id,
           name,
           service_types AS "serviceTypes",
           contact_person AS "contactPerson",
           phone,
           email,
           address,
           notes,
           created_at AS "createdAt",
           updated_at AS "updatedAt"
         FROM providers
         WHERE name ILIKE $1 OR contact_person ILIKE $1
         ORDER BY name ASC`,
        [`%${q.trim()}%`]
      );
    } else {
      result = await pool.query(
        `SELECT
           id,
           name,
           service_types AS "serviceTypes",
           contact_person AS "contactPerson",
           phone,
           email,
           address,
           notes,
           created_at AS "createdAt",
           updated_at AS "updatedAt"
         FROM providers
         ORDER BY name ASC`
      );
    }
    res.json(result.rows);
  } catch (err) {
    req.log.error(err, "Error listing providers");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /providers
router.post("/providers", async (req, res) => {
  try {
    await ensureTable();
    const { name, serviceTypes, contactPerson, phone, email, address, notes } = req.body;
    if (!name) { res.status(400).json({ error: "name required" }); return; }
    const result = await pool.query(
      `INSERT INTO providers (name, service_types, contact_person, phone, email, address, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING
         id,
         name,
         service_types AS "serviceTypes",
         contact_person AS "contactPerson",
         phone,
         email,
         address,
         notes,
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [
        name,
        JSON.stringify(serviceTypes ?? []),
        contactPerson ?? null,
        phone ?? null,
        email ?? null,
        address ?? null,
        notes ?? null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    req.log.error(err, "Error creating provider");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /providers/:id
router.put("/providers/:id", async (req, res) => {
  try {
    await ensureTable();
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { name, serviceTypes, contactPerson, phone, email, address, notes } = req.body;
    const result = await pool.query(
      `UPDATE providers SET
         name = COALESCE($1, name),
         service_types = COALESCE($2, service_types),
         contact_person = $3,
         phone = $4,
         email = $5,
         address = $6,
         notes = $7,
         updated_at = NOW()
       WHERE id = $8
       RETURNING
         id,
         name,
         service_types AS "serviceTypes",
         contact_person AS "contactPerson",
         phone,
         email,
         address,
         notes,
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [
        name ?? null,
        serviceTypes !== undefined ? JSON.stringify(serviceTypes) : null,
        contactPerson ?? null,
        phone ?? null,
        email ?? null,
        address ?? null,
        notes ?? null,
        id,
      ]
    );
    if (result.rowCount === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    req.log.error(err, "Error updating provider");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /providers/:id
router.delete("/providers/:id", async (req, res) => {
  try {
    await ensureTable();
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const result = await pool.query(`DELETE FROM providers WHERE id = $1`, [id]);
    if (result.rowCount === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Error deleting provider");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
