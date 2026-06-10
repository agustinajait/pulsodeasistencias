import { Router } from "express";
import { db, centersTable, roomsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router = Router();

function toDto(center: typeof centersTable.$inferSelect) {
  return { id: center.id, name: center.name, hasPasscode: !!center.passcode };
}

router.get("/centers", async (req, res) => {
  try {
    const centers = await db.select().from(centersTable).orderBy(centersTable.id);
    res.json(centers.map(toDto));
  } catch (err) {
    req.log.error(err, "Error listing centers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/centers", async (req, res) => {
  try {
    const { name, passcode } = req.body as { name?: string; passcode?: string };
    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
    const [created] = await db
      .insert(centersTable)
      .values({ name: name.trim(), passcode: passcode?.trim() || null })
      .returning();
    res.status(201).json(toDto(created));
  } catch (err) {
    req.log.error(err, "Error creating center");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/centers/:centerId", async (req, res) => {
  try {
    const centerId = parseInt(req.params.centerId);
    if (isNaN(centerId)) { res.status(400).json({ error: "Invalid centerId" }); return; }
    const { name, passcode } = req.body as { name?: string; passcode?: string };
    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
    const updateData: Partial<typeof centersTable.$inferInsert> = { name: name.trim() };
    if (passcode !== undefined) updateData.passcode = passcode.trim() || null;
    const [updated] = await db.update(centersTable).set(updateData).where(eq(centersTable.id, centerId)).returning();
    if (!updated) { res.status(404).json({ error: "Center not found" }); return; }
    res.json(toDto(updated));
  } catch (err) {
    req.log.error(err, "Error updating center");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/centers/:centerId/verify", async (req, res) => {
  try {
    const centerId = parseInt(req.params.centerId);
    if (isNaN(centerId)) { res.status(400).json({ error: "Invalid centerId" }); return; }
    const { passcode } = req.body as { passcode?: string };
    if (!passcode) { res.status(400).json({ error: "passcode is required" }); return; }
    const [center] = await db.select().from(centersTable).where(eq(centersTable.id, centerId));
    if (!center) { res.status(404).json({ error: "Center not found" }); return; }
    if (!center.passcode || center.passcode === passcode.trim()) {
      res.json({ status: "ok" });
    } else {
      res.status(401).json({ status: "invalid" });
    }
  } catch (err) {
    req.log.error(err, "Error verifying passcode");
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
