/**
 * Sync CAIPLI Sur (centerId=2) children for ECO 1, ECO 2, ECO 3
 * against the correct room lists from Excel files (June 2026).
 *
 * What this does:
 *  1. Finds the ECO 1/2/3 rooms for centerId=2
 *  2. For each room, compares DB children vs Excel list
 *  3. Adds missing children
 *  4. Marks children NOT in the Excel as inactive (activo=false)
 *  5. Moves children who are in the wrong room
 *  6. Fixes the ALCALA LEON / AYELLEN ELIZABEH apellido↔nombre swap
 *
 * Run with: DATABASE_URL=... pnpm tsx scripts/src/sync-sur-salas.ts
 */

import { db, childrenTable, roomsTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";

// Correct lists from Excel (June 2026)
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

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

async function main() {
  // Find rooms for centerId=2 with ecoNumber 1,2,3
  const allRooms = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.centerId, 2));

  console.log("Rooms for centerId=2:", allRooms.map((r) => `${r.id}:${r.nombre}`));

  // Match rooms to ecoNumber by name pattern
  const roomByEco: Record<number, typeof allRooms[0]> = {};
  for (const room of allRooms) {
    const m = room.nombre.match(/ECO\s*(\d)/i);
    if (m) roomByEco[parseInt(m[1])] = room;
  }

  console.log("ECO→roomId:", Object.fromEntries(Object.entries(roomByEco).map(([e, r]) => [e, r.id])));

  let fixed = 0;
  let added = 0;
  let deactivated = 0;

  for (const eco of [1, 2, 3] as const) {
    const room = roomByEco[eco];
    if (!room) { console.log(`⚠ No room found for ECO ${eco}`); continue; }

    // Load all children in this room
    const dbKids = await db
      .select()
      .from(childrenTable)
      .where(eq(childrenTable.roomId, room.id));

    const excelList = EXCEL[eco];
    console.log(`\n--- ECO ${eco} (roomId=${room.id}) ---`);
    console.log(`  DB: ${dbKids.length} children, Excel: ${excelList.length}`);

    // Fix ALCALA LEON swap first
    for (const kid of dbKids) {
      if (
        normalize(kid.apellido) === "AYELLEN ELIZABEH" &&
        normalize(kid.nombre).startsWith("ALCALA")
      ) {
        console.log(`  🔁 Fixing swap: ${kid.apellido} / ${kid.nombre}`);
        await db
          .update(childrenTable)
          .set({ apellido: "ALCALA LEON", nombre: "AYELLEN ELIZABEH" })
          .where(eq(childrenTable.id, kid.id));
        kid.apellido = "ALCALA LEON";
        kid.nombre = "AYELLEN ELIZABEH";
        fixed++;
      }
    }

    // For each Excel entry, find match in DB
    const matchedDbIds = new Set<number>();

    for (const ex of excelList) {
      const normAp = normalize(ex.ap);
      const normNb = normalize(ex.nb);

      const match = dbKids.find(
        (k) =>
          normalize(k.apellido) === normAp &&
          normalize(k.nombre).startsWith(normNb.split(" ")[0])
      );

      if (match) {
        matchedDbIds.add(match.id);
        // Ensure active
        if (!match.activo) {
          console.log(`  ✅ Reactivating: ${match.apellido} ${match.nombre}`);
          await db
            .update(childrenTable)
            .set({ activo: true })
            .where(eq(childrenTable.id, match.id));
          fixed++;
        }
        // Update apellido/nombre to canonical Excel version if different
        if (
          normalize(match.apellido) !== normAp ||
          normalize(match.nombre) !== normalize(ex.nb)
        ) {
          // only fix if clearly same person (first name word matches)
          const sameFirstWord =
            normalize(match.nombre).split(" ")[0] === normNb.split(" ")[0];
          if (sameFirstWord) {
            console.log(
              `  ✏ Updating name: "${match.apellido} ${match.nombre}" → "${ex.ap} ${ex.nb}"`
            );
            await db
              .update(childrenTable)
              .set({ apellido: ex.ap, nombre: ex.nb })
              .where(eq(childrenTable.id, match.id));
            fixed++;
          }
        }
      } else {
        // Not found — insert
        console.log(`  ➕ Adding: ${ex.ap} / ${ex.nb}`);
        const [inserted] = await db
          .insert(childrenTable)
          .values({
            roomId: room.id,
            apellido: ex.ap,
            nombre: ex.nb,
            activo: true,
            estado: "INSCRIPTX",
            estAsist: "Regular",
          })
          .returning();
        matchedDbIds.add(inserted.id);
        added++;
      }
    }

    // Deactivate children NOT in the Excel list
    for (const kid of dbKids) {
      if (!matchedDbIds.has(kid.id) && kid.activo) {
        console.log(`  🚫 Deactivating (not in Excel): ${kid.apellido} ${kid.nombre}`);
        await db
          .update(childrenTable)
          .set({ activo: false })
          .where(eq(childrenTable.id, kid.id));
        deactivated++;
      }
    }
  }

  console.log(`\n✅ Done: ${added} added, ${fixed} fixed, ${deactivated} deactivated`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
