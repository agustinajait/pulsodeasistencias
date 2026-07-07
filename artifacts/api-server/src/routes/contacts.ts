import { Router } from "express";
import { db, contactsTable, childrenTable, roomsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { CreateContactBody } from "@workspace/api-zod";
import { resolveCenter } from "../middleware/auth.js";

const router = Router();

// GET /contacts
router.get("/contacts", async (req, res) => {
  try {
    const { childId, roomId } = req.query as {
      childId?: string;
      roomId?: string;
    };
    const effectiveCenterId = resolveCenter(req, null);

    const rooms = await db.select().from(roomsTable);
    const roomMap: Record<number, number> = {};
    rooms.forEach((r) => (roomMap[r.id] = r.ecoNumber));

    // Determine which childIds to fetch, always scoped to the effective center
    let childIds: number[] = [];
    if (childId) {
      childIds = [parseInt(childId)];
    } else if (roomId) {
      const kids = await db
        .select({ id: childrenTable.id })
        .from(childrenTable)
        .where(eq(childrenTable.roomId, parseInt(roomId)));
      childIds = kids.map((k) => k.id);
    } else if (effectiveCenterId) {
      // scope to this center's rooms
      const centerRoomIds = rooms.filter((r) => r.centerId === effectiveCenterId).map((r) => r.id);
      if (centerRoomIds.length > 0) {
        const kids = await db.select({ id: childrenTable.id }).from(childrenTable).where(inArray(childrenTable.roomId, centerRoomIds));
        childIds = kids.map((k) => k.id);
      }
    }

    const children = await db
      .select({ id: childrenTable.id, apellido: childrenTable.apellido, nombre: childrenTable.nombre, roomId: childrenTable.roomId })
      .from(childrenTable);
    const childMap: Record<number, { name: string; ecoNumber: number }> = {};
    children.forEach((c) => {
      childMap[c.id] = {
        name: `${c.apellido} — ${c.nombre}`,
        ecoNumber: roomMap[c.roomId] ?? 0,
      };
    });

    let contacts;
    if (childIds.length > 0) {
      contacts = await db
        .select()
        .from(contactsTable)
        .where(childIds.length === 1 ? eq(contactsTable.childId, childIds[0]) : inArray(contactsTable.childId, childIds))
        .orderBy(desc(contactsTable.fecha));
    } else if (!effectiveCenterId) {
      // only superadmin with no centerId filter gets everything
      contacts = await db.select().from(contactsTable).orderBy(desc(contactsTable.fecha));
    } else {
      contacts = [];
    }

    res.json(
      contacts.map((c) => ({
        ...c,
        childName: childMap[c.childId]?.name ?? null,
        ecoNumber: childMap[c.childId]?.ecoNumber ?? null,
        quien: c.quien ?? null,
        motivo: c.motivo ?? null,
        obs: c.obs ?? null,
        resultado: c.resultado ?? null,
      }))
    );
  } catch (err) {
    req.log.error(err, "Error listing contacts");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /contacts
router.post("/contacts", async (req, res) => {
  try {
    const parsed = CreateContactBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const [contact] = await db
      .insert(contactsTable)
      .values({
        childId: parsed.data.childId,
        fecha: parsed.data.fecha,
        quien: parsed.data.quien ?? null,
        motivo: parsed.data.motivo ?? null,
        obs: parsed.data.obs ?? null,
        resultado: parsed.data.resultado ?? null,
      })
      .returning();

    const rooms = await db.select().from(roomsTable);
    const roomMap: Record<number, number> = {};
    rooms.forEach((r) => (roomMap[r.id] = r.ecoNumber));

    const [child] = await db
      .select()
      .from(childrenTable)
      .where(eq(childrenTable.id, contact.childId))
      .limit(1);

    res.status(201).json({
      ...contact,
      childName: child ? `${child.apellido} — ${child.nombre}` : null,
      ecoNumber: child ? (roomMap[child.roomId] ?? null) : null,
      quien: contact.quien ?? null,
      motivo: contact.motivo ?? null,
      obs: contact.obs ?? null,
      resultado: contact.resultado ?? null,
    });
  } catch (err) {
    req.log.error(err, "Error creating contact");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
