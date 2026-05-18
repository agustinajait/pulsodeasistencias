import { Router } from "express";
import { db, childrenTable, roomsTable, attendanceTable, contactsTable } from "@workspace/db";
import { eq, and, ilike, or, sql, desc, inArray } from "drizzle-orm";
import { CreateChildBody, UpdateChildBody, DischargeChildBody } from "@workspace/api-zod";

const router = Router();

const TODAY = () => new Date().toISOString().slice(0, 10);

function getWorkdaysBefore(dateStr: string, n: number): string[] {
  const result: string[] = [];
  const d = new Date(dateStr + "T12:00:00");
  while (result.length < n) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      result.push(d.toISOString().slice(0, 10));
    }
  }
  return result;
}

function calcConsecAbsences(
  childId: number,
  today: string,
  attMap: Record<string, string | null>
): number {
  const allDays = [today, ...getWorkdaysBefore(today, 14)];
  let consec = 0;
  for (const d of allDays) {
    const v = attMap[d];
    if (v === "A") consec++;
    else if (v === "P") break;
    else break;
  }
  return consec;
}

// GET /children
router.get("/children", async (req, res) => {
  try {
    const { roomId, centerId, active, search } = req.query as {
      roomId?: string;
      centerId?: string;
      active?: string;
      search?: string;
    };

    const rooms = await db.select().from(roomsTable);
    const roomMap: Record<number, number> = {};
    rooms.forEach((r) => (roomMap[r.id] = r.ecoNumber));

    let query = db.select().from(childrenTable).$dynamic();
    const conditions = [];

    if (roomId) {
      conditions.push(eq(childrenTable.roomId, parseInt(roomId)));
    } else if (centerId) {
      const centerRoomIds = rooms.filter((r) => r.centerId === parseInt(centerId)).map((r) => r.id);
      if (centerRoomIds.length > 0) {
          conditions.push(inArray(childrenTable.roomId, centerRoomIds));
      } else {
        res.json([]);
        return;
      }
    }
    if (active !== undefined) conditions.push(eq(childrenTable.activo, active === "true"));
    if (search) {
      conditions.push(
        or(
          ilike(childrenTable.apellido, `%${search}%`),
          ilike(childrenTable.nombre, `%${search}%`)
        )!
      );
    }

    if (conditions.length > 0) query = query.where(and(...conditions));

    const children = await query.orderBy(childrenTable.apellido, childrenTable.nombre);

    const result = children.map((c) => ({
      ...c,
      ecoNumber: roomMap[c.roomId] ?? 0,
      fnac: c.fnac ?? null,
      inscripto: c.inscripto ?? null,
      fechaBaja: c.fechaBaja ?? null,
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err, "Error listing children");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /children
router.post("/children", async (req, res) => {
  try {
    const parsed = CreateChildBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const room = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, parsed.data.roomId))
      .limit(1);
    if (!room.length) {
      res.status(400).json({ error: "Room not found" });
      return;
    }

    const [child] = await db
      .insert(childrenTable)
      .values({
        roomId: parsed.data.roomId,
        apellido: parsed.data.apellido.toUpperCase(),
        nombre: parsed.data.nombre.toUpperCase(),
        dni: parsed.data.dni ?? null,
        fnac: parsed.data.fnac ?? null,
        genero: parsed.data.genero ?? null,
        domicilio: parsed.data.domicilio ?? null,
        barrio: parsed.data.barrio ?? null,
        localidad: parsed.data.localidad ?? null,
        famApellido: parsed.data.famApellido?.toUpperCase() ?? null,
        famNombre: parsed.data.famNombre?.toUpperCase() ?? null,
        vinculo: parsed.data.vinculo ?? null,
        celular: parsed.data.celular ?? null,
        email: parsed.data.email ?? null,
        obs: parsed.data.obs ?? null,
        estado: "INSCRIPTX",
        estAsist: "Regular",
        activo: true,
        inscripto: TODAY(),
      })
      .returning();

    res.status(201).json({ ...child, ecoNumber: room[0].ecoNumber });
  } catch (err) {
    req.log.error(err, "Error creating child");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /children/:id
router.get("/children/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [child] = await db
      .select()
      .from(childrenTable)
      .where(eq(childrenTable.id, id))
      .limit(1);

    if (!child) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const rooms = await db.select().from(roomsTable).where(eq(roomsTable.id, child.roomId)).limit(1);
    const ecoNumber = rooms[0]?.ecoNumber ?? 0;

    const attendance = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.childId, id))
      .orderBy(desc(attendanceTable.fecha));

    const contacts = await db
      .select()
      .from(contactsTable)
      .where(eq(contactsTable.childId, id))
      .orderBy(desc(contactsTable.fecha));

    const today = TODAY();
    const attMap: Record<string, string | null> = {};
    attendance.forEach((a) => (attMap[a.fecha] = a.estado ?? null));
    const consecutiveAbsences = calcConsecAbsences(id, today, attMap);

    const attFormatted = attendance.map((a) => ({
      ...a,
      estado: a.estado ?? null,
      nota: a.nota ?? null,
      motivo: a.motivo ?? null,
    }));

    const contactsFormatted = contacts.map((c) => ({
      ...c,
      childName: `${child.apellido} — ${child.nombre}`,
      ecoNumber,
      quien: c.quien ?? null,
      motivo: c.motivo ?? null,
      obs: c.obs ?? null,
      resultado: c.resultado ?? null,
    }));

    res.json({
      ...child,
      ecoNumber,
      fnac: child.fnac ?? null,
      inscripto: child.inscripto ?? null,
      fechaBaja: child.fechaBaja ?? null,
      attendance: attFormatted,
      contacts: contactsFormatted,
      consecutiveAbsences,
    });
  } catch (err) {
    req.log.error(err, "Error getting child");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /children/:id
router.patch("/children/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = UpdateChildBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const updates: Partial<typeof childrenTable.$inferInsert> = {};
    const d = parsed.data;

    if (d.roomId !== undefined) updates.roomId = d.roomId;
    if (d.apellido !== undefined) updates.apellido = d.apellido.toUpperCase();
    if (d.nombre !== undefined) updates.nombre = d.nombre.toUpperCase();
    if (d.dni !== undefined) updates.dni = d.dni;
    if (d.fnac !== undefined) updates.fnac = d.fnac;
    if (d.genero !== undefined) updates.genero = d.genero;
    if (d.domicilio !== undefined) updates.domicilio = d.domicilio;
    if (d.barrio !== undefined) updates.barrio = d.barrio;
    if (d.localidad !== undefined) updates.localidad = d.localidad;
    if (d.famApellido !== undefined) updates.famApellido = d.famApellido.toUpperCase();
    if (d.famNombre !== undefined) updates.famNombre = d.famNombre.toUpperCase();
    if (d.vinculo !== undefined) updates.vinculo = d.vinculo;
    if (d.celular !== undefined) updates.celular = d.celular;
    if (d.email !== undefined) updates.email = d.email;
    if (d.obs !== undefined) updates.obs = d.obs;
    if (d.estAsist !== undefined) updates.estAsist = d.estAsist;

    const [updated] = await db
      .update(childrenTable)
      .set(updates)
      .where(eq(childrenTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const rooms = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, updated.roomId))
      .limit(1);

    res.json({ ...updated, ecoNumber: rooms[0]?.ecoNumber ?? 0 });
  } catch (err) {
    req.log.error(err, "Error updating child");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /children/:id
router.delete("/children/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [deleted] = await db.delete(childrenTable).where(eq(childrenTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ status: "ok" });
  } catch (err) {
    req.log.error(err, "Error deleting child");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /children/:id/discharge
router.post("/children/:id/discharge", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = DischargeChildBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const LABELS: Record<string, string> = {
      "baja-vol": "Baja voluntaria",
      "baja-aus": "Ausencias reiteradas",
      "pase-cpi": "Pase a otro CPI",
      "pase-jardin": "Pase a jardin",
      otro: "Otro",
    };

    const [updated] = await db
      .update(childrenTable)
      .set({
        activo: false,
        estado: "BAJA",
        fechaBaja: TODAY(),
        motivoBaja: LABELS[parsed.data.tipo] ?? parsed.data.tipo,
        tipoBaja: parsed.data.tipo,
      })
      .where(eq(childrenTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Register contact
    await db.insert(contactsTable).values({
      childId: id,
      fecha: TODAY(),
      quien: "Sistema",
      motivo: "Egreso: " + (LABELS[parsed.data.tipo] ?? parsed.data.tipo),
      obs: parsed.data.obs ?? null,
      resultado: "Baja",
    });

    const rooms = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, updated.roomId))
      .limit(1);

    res.json({ ...updated, ecoNumber: rooms[0]?.ecoNumber ?? 0 });
  } catch (err) {
    req.log.error(err, "Error discharging child");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /children/:id/reinstate
router.post("/children/:id/reinstate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [updated] = await db
      .update(childrenTable)
      .set({
        activo: true,
        estado: "INSCRIPTX",
        estAsist: "Regular",
        fechaBaja: null,
        motivoBaja: null,
        tipoBaja: null,
      })
      .where(eq(childrenTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const obs = (req.body as { obs?: string }).obs ?? "";
    await db.insert(contactsTable).values({
      childId: id,
      fecha: TODAY(),
      quien: "Sistema",
      motivo: "Alta",
      obs: obs || null,
      resultado: "Asiste",
    });

    const rooms = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, updated.roomId))
      .limit(1);

    res.json({ ...updated, ecoNumber: rooms[0]?.ecoNumber ?? 0 });
  } catch (err) {
    req.log.error(err, "Error reinstating child");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
