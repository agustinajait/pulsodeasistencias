import { Router } from "express";
import { db, roomsTable, childrenTable, attendanceTable, centersTable, pool } from "@workspace/db";
import { eq, and, gte, inArray, count, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";

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
    // Use raw SQL to avoid failure if check_in_token column doesn't exist yet
    let rooms: any[];
    try {
      if (centerId) {
        const cid = parseInt(centerId);
        rooms = await db.select().from(roomsTable).where(eq(roomsTable.centerId, cid)).orderBy(roomsTable.ecoNumber);
      } else {
        rooms = await db.select().from(roomsTable).orderBy(roomsTable.ecoNumber);
      }
    } catch {
      // Fallback: select without check_in_token column (not yet migrated)
      const sql = centerId
        ? `SELECT id, center_id AS "centerId", eco_number AS "ecoNumber", name, capacity FROM rooms WHERE center_id = $1 ORDER BY eco_number`
        : `SELECT id, center_id AS "centerId", eco_number AS "ecoNumber", name, capacity FROM rooms ORDER BY eco_number`;
      const result = centerId ? await pool.query(sql, [parseInt(centerId)]) : await pool.query(sql);
      rooms = result.rows;
      return res.json(rooms);
    }
    // Auto-generate checkInToken for rooms that don't have one (no-op if column missing)
    try {
      const roomsWithoutToken = rooms.filter((r) => !r.checkInToken);
      if (roomsWithoutToken.length > 0) {
        await Promise.all(
          roomsWithoutToken.map((r) =>
            db.update(roomsTable).set({ checkInToken: randomBytes(24).toString("hex") }).where(eq(roomsTable.id, r.id))
          )
        );
        rooms = rooms.map((r) => ({ ...r, checkInToken: r.checkInToken ?? randomBytes(24).toString("hex") }));
      }
    } catch {
      // column not yet migrated — return rooms without tokens
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
    const [created] = await db.insert(roomsTable).values({ centerId, ecoNumber, name: name.trim(), capacity, checkInToken: randomBytes(24).toString("hex") }).returning();
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
    let recentAtt: Array<{ childId: number; fecha: string; estado: string | null; mercaderia: boolean | null }> = [];
    if (allActiveIds.length > 0) {
      recentAtt = await db
        .select({ childId: attendanceTable.childId, fecha: attendanceTable.fecha, estado: attendanceTable.estado, mercaderia: attendanceTable.mercaderia })
        .from(attendanceTable)
        .where(and(gte(attendanceTable.fecha, cutoff), inArray(attendanceTable.childId, allActiveIds)));
    }

    const kidAttMap: Record<number, Record<string, { estado: string | null; mercaderia: boolean | null }>> = {};
    recentAtt.forEach((a) => {
      if (!kidAttMap[a.childId]) kidAttMap[a.childId] = {};
      kidAttMap[a.childId][a.fecha] = { estado: a.estado ?? null, mercaderia: a.mercaderia ?? false };
    });

    const SPECIAL_ESTADOS = ["EN REVISION", "ALERTA"];
    const summary = rooms.map((room) => {
      const kids = allChildren.filter((c) => c.roomId === room.id);
      const activeKids = kids.filter((c) => !SPECIAL_ESTADOS.includes((c as any).estado ?? ""));
      const total = activeKids.length;
      const att = todayAtt.filter((a) => activeKids.some((k) => k.id === a.childId));

      const present = att.filter((a) => a.estado === "P").length;
      const absent = att.filter((a) => a.estado === "A").length;
      const mercaderia = att.filter((a) => a.mercaderia).length;
      const unmarked = total - att.filter((a) => a.estado).length;
      const pct = total > 0 ? Math.round((present / total) * 100) : 0;

      let alerts = 0;
      activeKids.filter((kid) => !(kid as any).asistenciaParcial).forEach((kid) => {
        const dayMap = kidAttMap[kid.id] ?? {};
        let consec = 0;
        for (const d of allDays) {
          const entry = dayMap[d];
          if (entry?.estado === "A" && !entry?.mercaderia) consec++;
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
