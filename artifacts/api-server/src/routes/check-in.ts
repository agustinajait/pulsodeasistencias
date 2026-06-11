import { Router } from "express";
import { db, roomsTable, childrenTable, attendanceTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export const checkInRouter = Router();

// GET /check-in/:token — public, returns room name + children list
checkInRouter.get("/:token", async (req, res) => {
  try {
    const room = await db.query.rooms.findFirst({ where: eq(roomsTable.checkInToken, req.params.token) });
    if (!room) { res.status(404).json({ error: "QR no válido" }); return; }
    const kids = await db
      .select({ id: childrenTable.id, apellido: childrenTable.apellido, nombre: childrenTable.nombre })
      .from(childrenTable)
      .where(and(eq(childrenTable.roomId, room.id), eq(childrenTable.activo, true)));
    res.json({ roomId: room.id, roomName: room.name, children: kids });
  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /check-in/:token/mark — public, marks child as Present
checkInRouter.post("/:token/mark", async (req, res) => {
  try {
    const { childId } = req.body as { childId?: number };
    if (!childId) { res.status(400).json({ error: "childId requerido" }); return; }
    const room = await db.query.rooms.findFirst({ where: eq(roomsTable.checkInToken, req.params.token) });
    if (!room) { res.status(404).json({ error: "QR no válido" }); return; }
    // verify child belongs to this room
    const child = await db.query.children.findFirst({
      where: and(eq(childrenTable.id, childId), eq(childrenTable.roomId, room.id), eq(childrenTable.activo, true)),
    });
    if (!child) { res.status(403).json({ error: "Niño/a no encontrado en esta sala" }); return; }
    const today = new Date().toISOString().slice(0, 10);
    // upsert attendance — conflict on (childId, fecha)
    await db
      .insert(attendanceTable)
      .values({ childId, fecha: today, estado: "P" })
      .onConflictDoUpdate({
        target: [attendanceTable.childId, attendanceTable.fecha],
        set: { estado: "P" },
      });
    res.json({ ok: true, nombre: child.nombre, apellido: child.apellido });
  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
});
