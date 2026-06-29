import { Router } from "express";
import { db, childrenTable, roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Correct lists from Excel (June 2026) for CAIPLI Sur (centerId=2)
const EXCEL: Record<number, Array<{ ap: string; nb: string }>> = {
  1: [
    { ap: "ABURTO DELGADO", nb: "MATHEO KENAN" },
    { ap: "ACEVEDO", nb: "BASTIAN LAUTARO" },
    { ap: "ACUÑA VALDEZ", nb: "THEO TAHIEL" },
    { ap: "ALCALA LEON", nb: "AYELLEN ELIZABEH" },
    { ap: "ALVARENGA CHAVEZ", nb: "IVAN GONZALO" },
    { ap: "ALVAREZ VILLENA", nb: "MARTIN EMILIANO" },
    { ap: "ANGELO YAÑEZ", nb: "DYLAN CAMILO" },
    { ap: "AYALA BARRIOS", nb: "IRIS VICTORIA" },
    { ap: "BARRIOS", nb: "MILAGROS ALAI" },
    { ap: "BERDUGO PRADA", nb: "ALAIA ISABELLA" },
    { ap: "BOLIVAR", nb: "SAMANTA AITANA" },
    { ap: "BOTELLO", nb: "VALENTIN ALEJANDRO" },
    { ap: "CÓRDOBA", nb: "AMBAR SOPHIA" },
    { ap: "DEL VILLAR GIL", nb: "ENZO TOMAS" },
    { ap: "DURAN LOPEZ", nb: "IAN GAEL" },
    { ap: "FERNANDEZ", nb: "ALESSIA" },
    { ap: "FERNANDEZ RODRIGUEZ", nb: "EITHAN" },
    { ap: "GARCIA VILLANUEVA", nb: "VALERIA" },
    { ap: "GONZALEZ", nb: "SHAYLY MARIA ESTAFENIA" },
    { ap: "GONZALEZ GENES", nb: "SANTIAGO RAMON" },
    { ap: "LOPEZ LLACCTA", nb: "SAMARA" },
    { ap: "MENDEZ MORY", nb: "DAYRON JOSUE" },
    { ap: "SANABRIA PECHO", nb: "AINARA ISABELLA" },
    { ap: "VENEZIA", nb: "HERRERA GUEVARA" },
    { ap: "WAGENER", nb: "GÉNESIS RUBI" },
    { ap: "LUJAN", nb: "GIANELLA" },
  ],
  2: [
    { ap: "ABIDO", nb: "BRUNO" },
    { ap: "ALARCON SANCHEZ", nb: "EITAN SANCHEZ" },
    { ap: "ALLENDE COLMAN", nb: "GAEL LEONARDO" },
    { ap: "BENITEZ LEZCANO", nb: "KEYLA BELEN" },
    { ap: "BERTOLOTTI", nb: "ELIAM DANIEL" },
    { ap: "CAMPOS", nb: "IAN MÁXIMO" },
    { ap: "CAMPOS", nb: "TOMAS GAEL" },
    { ap: "CEJAS SARDINE", nb: "LIAM SERGIO" },
    { ap: "CERDAN", nb: "SOFIA ROCIO" },
    { ap: "CIENFUEGOS ROJAS", nb: "ZOE ISABELLA" },
    { ap: "DEL VALLE TORALES", nb: "FRANCISCO" },
    { ap: "ESCOBAR MONTECALVO", nb: "MATTEO" },
    { ap: "FERNANDEZ ROMERO", nb: "DAHIEL" },
    { ap: "FIGUEROA SANDOVAL", nb: "SAMANTHA" },
    { ap: "LOPEZ", nb: "MILAGROS" },
    { ap: "LUNA BOGADO", nb: "ADELYNNE" },
    { ap: "MARIANO VILLANUEVA", nb: "LUCIANA AITANA" },
    { ap: "ORIHUELA VALDERRAMA", nb: "BAUTISTA" },
    { ap: "PALACIOS", nb: "GUSTAVO C" },
    { ap: "PAREDES BAREIRO", nb: "URIEL" },
    { ap: "RAFAELICH", nb: "EMILY CHARL" },
    { ap: "RODRIGUEZ", nb: "FERNANDO" },
    { ap: "RODRIGUEZ", nb: "IVANA CATALEYA" },
    { ap: "RODRIGUEZ", nb: "RAPHAELA" },
    { ap: "SALINAS", nb: "ESMERALDA" },
    { ap: "SAMUDIO AMARILLA", nb: "GIOVANNI" },
    { ap: "SANCHEZ BALDEON", nb: "NOHA VALENTIN" },
    { ap: "SERRANO ALMENDRAS", nb: "IVAN ANTONIO" },
    { ap: "SILVA", nb: "GENESIS NICOL" },
    { ap: "VARGAS", nb: "SOFIA ANTONE" },
    { ap: "VASQUEZ", nb: "DARYL DANIEL" },
    { ap: "VELASQUEZ HUAMAN", nb: "ALEXANDER N" },
    { ap: "DIMILTA", nb: "LEON" },
    { ap: "INSFRAN", nb: "ALAN DAVID" },
  ],
  3: [
    { ap: "BARROCA FALCON", nb: "UMA ABIGAIL" },
    { ap: "CERNA", nb: "LARA" },
    { ap: "CHAVEZ ALFONZO", nb: "CARLOS GAEL" },
    { ap: "CORDOBA", nb: "LUNA" },
    { ap: "FERNANDEZ BENITEZ", nb: "GENESIS AITANA" },
    { ap: "GAILLARD CAMPOS", nb: "IAN SARIEL" },
    { ap: "GAMARRA CACERES", nb: "ALEXA MARIA" },
    { ap: "HUARIPATA ALDUNATE", nb: "ERICK JAVIER" },
    { ap: "J LUJAN COSTAS", nb: "KENDRA" },
    { ap: "JAVIER", nb: "MEILIN" },
    { ap: "LEDESMA", nb: "LIAM LUIS" },
    { ap: "LUGO ZARZA", nb: "MATEO ALEXANDER" },
    { ap: "MARECO CABALLERO", nb: "BASTIAN NATHANIEL" },
    { ap: "MARTINEZ FERNANDEZ", nb: "BENJAMIN" },
    { ap: "MEDINA MIRANDA", nb: "EMMA VALENTINA" },
    { ap: "MORINIGO RIVERO", nb: "MAXIMO ALEJANDRO" },
    { ap: "PARAMO OBANDO", nb: "THIAGO NAHUEL" },
    { ap: "SANTACRUZ SAMUDIO", nb: "LOHAN EZEQUIEL" },
    { ap: "SILVERO JIMENEZ", nb: "BRANDON" },
    { ap: "VAZQUEZ ESPINOLA", nb: "ZOE MARTINA" },
    { ap: "VEGA ARGUELLO", nb: "THIAGO IGNACIO" },
    { ap: "VERASTEGUI VARGAS", nb: "LAUTARO" },
    { ap: "YAÑEZ CUEVA", nb: "ISABELLA VICTORIA" },
    { ap: "JUAREZ", nb: "TEO MANUEL" },
  ],
};

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// GET /admin-sync/sur?key=koratic2026
router.get("/sur", async (req, res) => {
  if (req.query.key !== "koratic2026") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const log: string[] = [];
  let added = 0, fixed = 0, deactivated = 0;

  try {
    const allRooms = await db.select().from(roomsTable).where(eq(roomsTable.centerId, 2));
    log.push(`Rooms found: ${allRooms.map((r) => `${r.id}:eco${r.ecoNumber}:${r.name}`).join(", ")}`);

    const roomByEco: Record<number, typeof allRooms[0]> = {};
    for (const room of allRooms) {
      roomByEco[room.ecoNumber] = room;
    }

    for (const eco of [1, 2, 3]) {
      const room = roomByEco[eco];
      if (!room) { log.push(`⚠ No room for ECO ${eco}`); continue; }

      const dbKids = await db.select().from(childrenTable).where(eq(childrenTable.roomId, room.id));
      log.push(`\nECO ${eco} (roomId=${room.id}, name="${room.name}"): DB=${dbKids.length}, Excel=${EXCEL[eco].length}`);

      // Fix ALCALA LEON swap
      for (const kid of dbKids) {
        if (norm(kid.apellido) === "AYELLEN ELIZABEH" && norm(kid.nombre).startsWith("ALCALA")) {
          await db.update(childrenTable)
            .set({ apellido: "ALCALA LEON", nombre: "AYELLEN ELIZABEH" })
            .where(eq(childrenTable.id, kid.id));
          log.push(`  🔁 Fixed swap: ${kid.apellido} / ${kid.nombre}`);
          kid.apellido = "ALCALA LEON"; kid.nombre = "AYELLEN ELIZABEH";
          fixed++;
        }
      }

      const matchedIds = new Set<number>();

      for (const ex of EXCEL[eco]) {
        const normAp = norm(ex.ap);
        const normNb = norm(ex.nb);
        const firstWord = normNb.split(" ")[0];

        const match = dbKids.find(
          (k) => norm(k.apellido) === normAp && norm(k.nombre).split(" ")[0] === firstWord
        );

        if (match) {
          matchedIds.add(match.id);
          if (!match.activo) {
            await db.update(childrenTable).set({ activo: true }).where(eq(childrenTable.id, match.id));
            log.push(`  ✅ Reactivated: ${match.apellido} ${match.nombre}`);
            fixed++;
          }
          // Fix nombre/apellido to canonical
          if (norm(match.apellido) !== normAp || norm(match.nombre) !== normNb) {
            await db.update(childrenTable)
              .set({ apellido: ex.ap, nombre: ex.nb })
              .where(eq(childrenTable.id, match.id));
            log.push(`  ✏ Updated: "${match.apellido} ${match.nombre}" → "${ex.ap} ${ex.nb}"`);
            fixed++;
          }
        } else {
          const [ins] = await db.insert(childrenTable).values({
            roomId: room.id, apellido: ex.ap, nombre: ex.nb,
            activo: true, estado: "INSCRIPTX", estAsist: "Regular",
          }).returning();
          matchedIds.add(ins.id);
          log.push(`  ➕ Added: ${ex.ap} / ${ex.nb}`);
          added++;
        }
      }

      for (const kid of dbKids) {
        if (!matchedIds.has(kid.id) && kid.activo) {
          await db.update(childrenTable).set({ activo: false }).where(eq(childrenTable.id, kid.id));
          log.push(`  🚫 Deactivated: ${kid.apellido} ${kid.nombre}`);
          deactivated++;
        }
      }
    }

    log.push(`\n✅ Done: ${added} added, ${fixed} fixed, ${deactivated} deactivated`);
    res.json({ ok: true, summary: { added, fixed, deactivated }, log });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message, log });
  }
});

// GET /admin-sync/norte-eco2-fix?key=koratic2026
// Deactivates EN REVISION children in ECO 2 of CAIPLI Norte (centerId=1)
router.get("/norte-eco2-fix", async (req, res) => {
  if (req.query.key !== "koratic2026") { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rooms = await db.select().from(roomsTable).where(eq(roomsTable.centerId, 1));
    const eco2 = rooms.find((r) => r.ecoNumber === 2);
    if (!eco2) { res.json({ error: "ECO 2 not found for centerId=1" }); return; }

    const kids = await db.select().from(childrenTable).where(eq(childrenTable.roomId, eco2.id));
    const toDeactivate = kids.filter((k) => k.activo && k.estado === "EN REVISION");

    for (const k of toDeactivate) {
      await db.update(childrenTable).set({ activo: false }).where(eq(childrenTable.id, k.id));
    }

    res.json({
      ok: true,
      deactivated: toDeactivate.length,
      names: toDeactivate.map((k) => `${k.apellido} ${k.nombre}`),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin-sync/norte-eco2?key=koratic2026
// Shows all active children in ECO 2 of CAIPLI Norte (centerId=1) grouped by estado
router.get("/norte-eco2", async (req, res) => {
  if (req.query.key !== "koratic2026") { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rooms = await db.select().from(roomsTable).where(eq(roomsTable.centerId, 1));
    const eco2 = rooms.find((r) => r.ecoNumber === 2);
    if (!eco2) { res.json({ error: "ECO 2 not found for centerId=1", rooms: rooms.map(r => `${r.id}:eco${r.ecoNumber}:${r.name}`) }); return; }

    const kids = await db.select({
      id: childrenTable.id,
      apellido: childrenTable.apellido,
      nombre: childrenTable.nombre,
      estado: childrenTable.estado,
      activo: childrenTable.activo,
    }).from(childrenTable).where(eq(childrenTable.roomId, eco2.id));

    const byEstado: Record<string, string[]> = {};
    for (const k of kids) {
      const key = `${k.estado}|activo=${k.activo}`;
      if (!byEstado[key]) byEstado[key] = [];
      byEstado[key].push(`${k.apellido} ${k.nombre}`);
    }

    res.json({ roomId: eco2.id, roomName: eco2.name, total: kids.length, byEstado });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
