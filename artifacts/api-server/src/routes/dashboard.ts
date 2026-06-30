import { Router } from "express";
import { db, childrenTable, attendanceTable, contactsTable, roomsTable } from "@workspace/db";
import { eq, desc, gte, and, inArray, ne } from "drizzle-orm";

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

// GET /dashboard/summary
router.get("/dashboard/summary", async (req, res) => {
  try {
    const today = TODAY();
    const currentMonth = today.slice(0, 7); // YYYY-MM
    const { centerId } = req.query as { centerId?: string };

    const allRooms = await db.select().from(roomsTable);
    const rooms = centerId ? allRooms.filter((r) => r.centerId === parseInt(centerId)) : allRooms;
    const roomIds = rooms.map((r) => r.id);
    const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);

    const allChildrenQ = roomIds.length > 0
      ? await db.select().from(childrenTable).where(inArray(childrenTable.roomId, roomIds))
      : await db.select().from(childrenTable);
    const allChildren = allChildrenQ;
    const active = allChildren.filter((c) => c.activo && c.estado !== "EN REVISION");
    const discharged = allChildren.filter((c) => !c.activo);

    const todayAtt = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.fecha, today));

    const present = todayAtt.filter((a) => a.estado === "P").length;
    const absent = todayAtt.filter((a) => a.estado === "A").length;
    const pctPresent = active.length > 0 ? Math.round((present / active.length) * 100) : 0;

    // Calc alerts
    const past14 = getWorkdaysBefore(today, 14);
    const cutoff = past14[past14.length - 1];
    const allDays = [today, ...past14];

    let recentAtt: Array<{ childId: number; fecha: string; estado: string | null; mercaderia: boolean | null }> = [];
    if (active.length > 0) {
      const activeIds = active.map((k) => k.id);
      recentAtt = await db
        .select({ childId: attendanceTable.childId, fecha: attendanceTable.fecha, estado: attendanceTable.estado, mercaderia: attendanceTable.mercaderia })
        .from(attendanceTable)
        .where(and(gte(attendanceTable.fecha, cutoff), inArray(attendanceTable.childId, activeIds)));
    }

    const kidAttMap: Record<number, Record<string, { estado: string | null; mercaderia: boolean | null }>> = {};
    recentAtt.forEach((a) => {
      if (!kidAttMap[a.childId]) kidAttMap[a.childId] = {};
      kidAttMap[a.childId][a.fecha] = { estado: a.estado ?? null, mercaderia: a.mercaderia ?? false };
    });

    let totalAlerts = 0;
    active.forEach((kid) => {
      const dayMap = kidAttMap[kid.id] ?? {};
      let consec = 0;
      for (const d of allDays) {
        const entry = dayMap[d];
        if (entry?.estado === "A" && !entry?.mercaderia) consec++;
        else break;
      }
      if (consec >= 2) totalAlerts++;
    });

    // Mercadería retirada en el mes actual
    const activeIds = active.map((k) => k.id);
    const monthMerch = activeIds.length > 0
      ? await db
          .select({ childId: attendanceTable.childId })
          .from(attendanceTable)
          .where(
            and(
              gte(attendanceTable.fecha, currentMonth + "-01"),
              inArray(attendanceTable.childId, activeIds),
              eq(attendanceTable.mercaderia, true)
            )
          )
      : [];
    const totalMercaderiaMonth = monthMerch.length;

    res.json({
      totalActive: active.length,
      totalPresent: present,
      totalAbsent: absent,
      totalAlerts,
      totalDischarge: discharged.length,
      totalCapacity,
      pctPresent,
      totalMercaderiaMonth,
    });
  } catch (err) {
    req.log.error(err, "Error getting dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /dashboard/summary-by-center  (super admin only)
router.get("/dashboard/summary-by-center", async (req, res) => {
  try {
    const today = TODAY();
    const allRooms = await db.select().from(roomsTable);

    // group rooms by centerId
    const centerIds = [...new Set(allRooms.map((r) => r.centerId).filter(Boolean))] as number[];

    const allChildren = await db.select().from(childrenTable);
    const todayAtt = await db.select().from(attendanceTable).where(eq(attendanceTable.fecha, today));

    const attByChild: Record<number, string | null> = {};
    todayAtt.forEach((a) => { attByChild[a.childId] = a.estado ?? null; });

    // import centers table to get names
    const { centersTable } = await import("@workspace/db");
    const allCenters = await db.select().from(centersTable);
    const centerNameMap: Record<number, string> = {};
    allCenters.forEach((c) => { centerNameMap[c.id] = c.name; });

    const result = centerIds.map((cid) => {
      const rooms = allRooms.filter((r) => r.centerId === cid);
      const roomIds = new Set(rooms.map((r) => r.id));
      const children = allChildren.filter((c) => roomIds.has(c.roomId));
      const active = children.filter((c) => c.activo && c.estado !== "EN REVISION");
      const discharged = children.filter((c) => !c.activo);
      const present = active.filter((c) => attByChild[c.id] === "P").length;
      const absent = active.filter((c) => attByChild[c.id] === "A").length;
      const capacity = rooms.reduce((s, r) => s + r.capacity, 0);
      return {
        centerId: cid,
        centerName: centerNameMap[cid] ?? `Centro ${cid}`,
        totalActive: active.length,
        totalPresent: present,
        totalAbsent: absent,
        totalDischarge: discharged.length,
        totalCapacity: capacity,
        pctPresent: active.length > 0 ? Math.round((present / active.length) * 100) : 0,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error(err, "Error getting summary by center");
    res.status(500).json({ error: "Internal server error" });
  }
});


router.get("/dashboard/alerts", async (req, res) => {
  try {
    const today = TODAY();
    const { centerId } = req.query as { centerId?: string };
    const past14 = getWorkdaysBefore(today, 14);
    const cutoff = past14[past14.length - 1];
    const allDays = [today, ...past14];

    const allRooms = await db.select().from(roomsTable);
    const rooms = centerId ? allRooms.filter((r) => r.centerId === parseInt(centerId)) : allRooms;
    const roomIds = rooms.map((r) => r.id);

    const active = roomIds.length > 0
      ? await db.select().from(childrenTable).where(and(eq(childrenTable.activo, true), ne(childrenTable.estado, "EN REVISION"), inArray(childrenTable.roomId, roomIds)))
      : await db.select().from(childrenTable).where(and(eq(childrenTable.activo, true), ne(childrenTable.estado, "EN REVISION")));
    const roomMap: Record<number, number> = {};
    const centerMap: Record<number, number> = {};
    rooms.forEach((r) => { roomMap[r.id] = r.ecoNumber; centerMap[r.id] = r.centerId; });

    if (!active.length) {
      res.json([]);
      return;
    }

    const activeIds = active.map((k) => k.id);
    const recentAtt = await db
      .select({ childId: attendanceTable.childId, fecha: attendanceTable.fecha, estado: attendanceTable.estado, mercaderia: attendanceTable.mercaderia })
      .from(attendanceTable)
      .where(and(gte(attendanceTable.fecha, cutoff), inArray(attendanceTable.childId, activeIds)));

    const kidAttMap: Record<number, Record<string, { estado: string | null; mercaderia: boolean | null }>> = {};
    recentAtt.forEach((a) => {
      if (!kidAttMap[a.childId]) kidAttMap[a.childId] = {};
      kidAttMap[a.childId][a.fecha] = { estado: a.estado ?? null, mercaderia: a.mercaderia ?? false };
    });

    const alerts = active
      .map((kid) => {
        const dayMap = kidAttMap[kid.id] ?? {};
        let consec = 0;
        for (const d of allDays) {
          const entry = dayMap[d];
          if (entry?.estado === "A" && !entry?.mercaderia) consec++;
          else break;
        }
        return { kid, consec };
      })
      .filter(({ consec }) => consec >= 2)
      .sort((a, b) => b.consec - a.consec)
      .map(({ kid, consec }) => ({
        childId: kid.id,
        apellido: kid.apellido,
        nombre: kid.nombre,
        roomId: kid.roomId,
        ecoNumber: roomMap[kid.roomId] ?? 0,
        centerId: centerMap[kid.roomId] ?? null,
        celular: kid.celular ?? null,
        famNombre: kid.famNombre ?? null,
        famApellido: kid.famApellido ?? null,
        consecutiveAbsences: consec,
      }));

    res.json(alerts);
  } catch (err) {
    req.log.error(err, "Error getting alerts");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /dashboard/monthly-trend — last 6 months avg attendance %
router.get("/dashboard/monthly-trend", async (req, res) => {
  try {
    const { centerId } = req.query as { centerId?: string };
    const allRooms = await db.select().from(roomsTable);
    const rooms = centerId ? allRooms.filter((r) => r.centerId === parseInt(centerId)) : allRooms;
    const roomIds = rooms.map((r) => r.id);

    // build last 6 months YYYY-MM
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const allChildren = roomIds.length > 0
      ? await db.select().from(childrenTable).where(inArray(childrenTable.roomId, roomIds))
      : await db.select().from(childrenTable);
    const activeIds = allChildren.filter((c) => c.activo && c.estado !== "EN REVISION").map((c) => c.id);

    const cutoff = months[0] + "-01";
    const attRows = activeIds.length > 0
      ? await db
          .select({ childId: attendanceTable.childId, fecha: attendanceTable.fecha, estado: attendanceTable.estado, mercaderia: attendanceTable.mercaderia })
          .from(attendanceTable)
          .where(and(gte(attendanceTable.fecha, cutoff), inArray(attendanceTable.childId, activeIds)))
      : [];

    // group by month
    const byMonth: Record<string, { present: number; total: number }> = {};
    months.forEach((m) => { byMonth[m] = { present: 0, total: 0 }; });

    // aggregate: for each (child, day) that has a record, count present vs total
    const daySet: Record<string, Set<string>> = {}; // month -> set of unique dates
    attRows.forEach((a) => {
      if (!a.fecha) return;
      const m = a.fecha.slice(0, 7);
      if (!byMonth[m]) return;
      if (!daySet[m]) daySet[m] = new Set();
      daySet[m].add(a.fecha);
    });

    // per month: sum present / total records (excluding mercaderia)
    attRows.forEach((a) => {
      if (!a.fecha) return;
      const m = a.fecha.slice(0, 7);
      if (!byMonth[m]) return;
      if (a.mercaderia) return; // exclude merch
      byMonth[m].total++;
      if (a.estado === "P") byMonth[m].present++;
    });

    const result = months.map((m) => {
      const { present, total } = byMonth[m];
      return {
        mes: m,
        present,
        total,
        pct: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error(err, "Error getting monthly trend");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /dashboard/recent-contacts
router.get("/dashboard/recent-contacts", async (req, res) => {
  try {
    const contacts = await db
      .select()
      .from(contactsTable)
      .orderBy(desc(contactsTable.fecha), desc(contactsTable.createdAt))
      .limit(10);

    const children = await db.select().from(childrenTable);
    const rooms = await db.select().from(roomsTable);
    const roomMap: Record<number, number> = {};
    rooms.forEach((r) => (roomMap[r.id] = r.ecoNumber));
    const childMap: Record<number, { name: string; ecoNumber: number }> = {};
    children.forEach((c) => {
      childMap[c.id] = {
        name: `${c.apellido} — ${c.nombre}`,
        ecoNumber: roomMap[c.roomId] ?? 0,
      };
    });

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
    req.log.error(err, "Error getting recent contacts");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
