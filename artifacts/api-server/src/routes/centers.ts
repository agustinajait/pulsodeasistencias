import { Router } from "express";
import { db, centersTable, roomsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router = Router();

router.get("/centers", async (req, res) => {
  try {
    const centers = await db.select().from(centersTable).orderBy(centersTable.id);
    res.json(centers);
  } catch (err) {
    req.log.error(err, "Error listing centers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/centers", async (req, res) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
    const [created] = await db.insert(centersTable).values({ name: name.trim() }).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error(err, "Error creating center");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/centers/:centerId", async (req, res) => {
  try {
    const centerId = parseInt(req.params.centerId);
    if (isNaN(centerId)) { res.status(400).json({ error: "Invalid centerId" }); return; }
    const { name } = req.body as { name?: string };
    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
    const [updated] = await db.update(centersTable).set({ name: name.trim() }).where(eq(centersTable.id, centerId)).returning();
    if (!updated) { res.status(404).json({ error: "Center not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err, "Error updating center");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/centers/:centerId", async (req, res) => {
  try {
    const centerId = parseInt(req.params.centerId);
    if (isNaN(centerId)) { res.status(400).json({ error: "Invalid centerId" }); return; }
    const [roomCount] = await db.select({ c: count() }).from(roomsTable).where(eq(roomsTable.centerId, centerId));
    if ((roomCount?.c ?? 0) > 0) {
      res.status(409).json({ error: "No se puede eliminar un centro con salas asignadas" });
      return;
    }
    const [deleted] = await db.delete(centersTable).where(eq(centersTable.id, centerId)).returning();
    if (!deleted) { res.status(404).json({ error: "Center not found" }); return; }
    res.json({ status: "deleted" });
  } catch (err) {
    req.log.error(err, "Error deleting center");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
