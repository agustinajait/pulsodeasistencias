import { Router } from "express";
import { db, attendanceTable, childrenTable } from "@workspace/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { MarkAttendanceBody } from "@workspace/api-zod";

const router = Router();

// GET /attendance
router.get("/attendance", async (req, res) => {
  try {
    const { date, roomId, childId, month, year } = req.query as {
      date?: string;
      roomId?: string;
      childId?: string;
      month?: string;
      year?: string;
    };

    let childIds: number[] = [];

    if (childId) {
      childIds = [parseInt(childId)];
    } else if (roomId) {
      const kids = await db
        .select({ id: childrenTable.id })
        .from(childrenTable)
        .where(and(eq(childrenTable.roomId, parseInt(roomId)), eq(childrenTable.activo, true)));
      childIds = kids.map((k) => k.id);
    }

    if (childIds.length === 0 && (childId || roomId)) {
      res.json([]);
      return;
    }

    const conditions = [];

    if (childIds.length > 0) {
      conditions.push(
        sql`${attendanceTable.childId} = ANY(${sql`ARRAY[${sql.join(childIds.map((id) => sql`${id}`), sql`, `)}]::int[]`})`
      );
    }

    if (date) {
      conditions.push(eq(attendanceTable.fecha, date));
    } else if (month) {
      const start = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      conditions.push(gte(attendanceTable.fecha, start));
      conditions.push(lte(attendanceTable.fecha, end));
    } else if (year) {
      conditions.push(gte(attendanceTable.fecha, `${year}-01-01`));
      conditions.push(lte(attendanceTable.fecha, `${year}-12-31`));
    }

    const query =
      conditions.length > 0
        ? db
            .select()
            .from(attendanceTable)
            .where(and(...conditions))
        : db.select().from(attendanceTable);

    const records = await query;

    res.json(
      records.map((r) => ({
        ...r,
        estado: r.estado ?? null,
        nota: r.nota ?? null,
        motivo: r.motivo ?? null,
      }))
    );
  } catch (err) {
    req.log.error(err, "Error listing attendance");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /attendance
router.post("/attendance", async (req, res) => {
  try {
    const parsed = MarkAttendanceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }

    const { childId, fecha, estado, nota, motivo, mercaderia } = parsed.data;

    // Upsert: insert or update
    const existing = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.childId, childId), eq(attendanceTable.fecha, fecha)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(attendanceTable)
        .set({
          estado: estado ?? null,
          nota: nota ?? null,
          motivo: motivo ?? null,
          mercaderia: mercaderia ?? false,
        })
        .where(and(eq(attendanceTable.childId, childId), eq(attendanceTable.fecha, fecha)))
        .returning();
      res.json({
        ...updated,
        estado: updated.estado ?? null,
        nota: updated.nota ?? null,
        motivo: updated.motivo ?? null,
      });
    } else {
      const [inserted] = await db
        .insert(attendanceTable)
        .values({
          childId,
          fecha,
          estado: estado ?? null,
          nota: nota ?? null,
          motivo: motivo ?? null,
          mercaderia: mercaderia ?? false,
        })
        .returning();
      res.json({
        ...inserted,
        estado: inserted.estado ?? null,
        nota: inserted.nota ?? null,
        motivo: inserted.motivo ?? null,
      });
    }
  } catch (err) {
    req.log.error(err, "Error marking attendance");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
