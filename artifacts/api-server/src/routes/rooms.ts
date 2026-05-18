import { Router } from "express";
import { db, roomsTable, childrenTable, attendanceTable, centersTable } from "@workspace/db";
import { eq, and, gte, inArray, count } from "drizzle-orm";

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

// GET /rooms
router.get("/rooms", async (req, res) => {
  try {
    const { centerId } = req.query as { centerId?: string };
    let rooms;
    if (centerId) {
      const cid = parseInt(centerId);
      rooms = await db.select().from(roomsTable).where(eq(roomsTable.centerId, cid)).orderBy(roomsTable.ecoNumber);
    } else {
      rooms = await db.select().from(roomsTable).orderBy(roomsTable.ecoNumber);
    }
    res.json(rooms);
  } catch (err) {
    req.log.error(err, "Error listing rooms");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /rooms
router.post("/rooms", async (req, res) => {
  try {
    const { centerId, ecoNumber, name, capacity } = req.body as {
      centerId?: number; ecoNumber?: number; name?: string; capacity?: number;
    };
    if (!centerId || ecoNumber == null || !name?.trim() || !capacity) {
      res.status(400).json({ error: "centerId, ecoNumber, name, capacity are required" });
      return;
    }
    const center = await db.select().from(centersTable).where(eq(centersTable.id, centerId));
    if (!center.length) { res.status(404).json({ error: "Center not found" }); return; }
    const [created] = await db.insert(roomsTable).values({ centerId, ecoNumber, name: name.trim(), capacity }).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error(err, "Error creating room");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /rooms/:roomId
router.delete("/rooms/:roomId", async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (isNaN(roomId)) { res.status(400).json({ error: "Invalid roomId" }); return; }
    const [childCount] = await db.select({ c: count() }).from(childrenTable).where(eq(childrenTable.roomId, roomId));
    if ((childCount?.c ?? 0) > 0) {
      res.status(409).json({ error: "No se puede eliminar una sala con niños asignados" });
      return;
    }
    const [deleted] = await db.delete(roomsTable).where(eq(roomsTable.id, roomId)).returning();
    if (!deleted) { res.status(404).json({ error: "Room not found" }); return; }
    res.json({ status: "deleted" });
  } catch (err) {
    req.log.error(err, "Error deleting room");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /rooms/:roomId
router.patch("/rooms/:roomId", async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (isNaN(roomId)) { res.status(400).json({ error: "Invalid roomId" }); return; }
    const { name, capacity } = req.body as { name?: string; capacity?: number };
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (capacity !== undefined) updates.capacity = capacity;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
    const [updated] = await db.update(roomsTable).set(updates).where(eq(roomsTable.id, roomId)).returning();
    if (!updated) { res.status(404).json({ error: "Room not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err, "Error updating room");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /rooms/summary
router.get("/rooms/summary", async (req, res) => {
  try {
    const today = TODAY();
    const { centerId } = req.query as { centerId?: string };
    const rooms = centerId
      ? await db.select().from(roomsTable).where(eq(roomsTable.centerId, parseInt(centerId))).orderBy(roomsTable.ecoNumber)
      : await db.select().from(roomsTable).orderBy(roomsTable.ecoNumber);
    const roomIds = rooms.map((r) => r.id);
    const allChildren = roomIds.length > 0
      ? await db.select().from(childrenTable).where(and(eq(childrenTable.activo, true), inArray(childrenTable.roomId, roomIds)))
      : [];
    const todayAtt = await db.select().from(attendanceTable).where(eq(attendanceTable.fecha, today));

    const past14 = getWorkdaysBefore(today, 14);
    const cutoff = past14[past14.length - 1];
    const allDays = [today, ...past14];

    // Get recent attendance for alert calculation
    const allActiveIds = allChildren.map((c) => c.id);
    let recentAtt: Array<{ childId: number; fecha: string; estado: string | null }> = [];
    if (allActiveIds.length > 0) {
      recentAtt = await db
        .select({ childId: attendanceTable.childId, fecha: attendanceTable.fecha, estado: attendanceTable.estado })
        .from(attendanceTable)
        .where(and(gte(attendanceTable.fecha, cutoff), inArray(attendanceTable.childId, allActiveIds)));
    }

    const kidAttMap: Record<number, Record<string, string | null>> = {};
    recentAtt.forEach((a) => {
      if (!kidAttMap[a.childId]) kidAttMap[a.childId] = {};
      kidAttMap[a.childId][a.fecha] = a.estado ?? null;
    });

    const summary = rooms.map((room) => {
      const kids = allChildren.filter((c) => c.roomId === room.id);
      const total = kids.length;
      const att = todayAtt.filter((a) => kids.some((k) => k.id === a.childId));

      const present = att.filter((a) => a.estado === "P").length;
      const absent = att.filter((a) => a.estado === "A").length;
      const mercaderia = att.filter((a) => a.mercaderia).length;
      const unmarked = total - att.filter((a) => a.estado).length;
      const pct = total > 0 ? Math.round((present / total) * 100) : 0;

      let alerts = 0;
      kids.forEach((kid) => {
        const dayMap = kidAttMap[kid.id] ?? {};
        let consec = 0;
        for (const d of allDays) {
          const v = dayMap[d];
          if (v === "A") consec++;
          else break;
        }
        if (consec >= 2) alerts++;
      });

      return {
        id: room.id,
        centerId: room.centerId,
        ecoNumber: room.ecoNumber,
        name: room.name,
        capacity: room.capacity,
        total,
        present,
        absent,
        mercaderia,
        unmarked,
        alerts,
        pct,
      };
    });

    res.json(summary);
  } catch (err) {
    req.log.error(err, "Error getting rooms summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
