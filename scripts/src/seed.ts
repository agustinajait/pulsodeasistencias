import { db } from "@workspace/db";
import { roomsTable, childrenTable, contactsTable, attendanceTable } from "@workspace/db";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface NinoRaw {
  id: number; ap: string; nb: string; sala: number; reg?: string;
  dni?: string; fnac?: string; genero?: string; dom?: string; barrio?: string;
  loc?: string; fam_ap?: string; fam_nb?: string; vinculo?: string;
  cel?: string; email?: string; estado?: string; est_asist?: string;
  resultado?: string; motivo?: string; activo?: boolean; inscripto?: string;
  llamados?: Array<{ fecha: string; quien?: string; obs?: string }>;
  fechaBaja?: string; motivoBaja?: string; tipoBaja?: string;
}

async function seed() {
  const html = readFileSync(
    join(__dirname, "../../attached_assets/cpi_sistema_v5_1778689000020.html"),
    "utf8"
  );
  const match = html.match(/const NINOS_RAW = (\[[\s\S]*?\]);/);
  if (!match) throw new Error("NINOS_RAW not found");
  const ninos: NinoRaw[] = JSON.parse(match[1]);

  console.log(`Found ${ninos.length} children`);

  // Clean slate
  await db.delete(contactsTable);
  await db.delete(attendanceTable);
  await db.delete(childrenTable);
  await db.delete(roomsTable);

  // Insert rooms
  const rooms = [
    { ecoNumber: 0, name: "Sala ECO 0 — Aldea 0", capacity: 30 },
    { ecoNumber: 1, name: "Sala ECO 1 — Aldea 1", capacity: 55 },
    { ecoNumber: 2, name: "Sala ECO 2 — Aldea 2", capacity: 60 },
    { ecoNumber: 3, name: "Sala ECO 3 — Aldea 3", capacity: 35 },
  ];
  const insertedRooms = await db.insert(roomsTable).values(rooms).returning();
  const roomIdMap: Record<number, number> = {};
  insertedRooms.forEach((r) => (roomIdMap[r.ecoNumber] = r.id));
  console.log("Rooms:", roomIdMap);

  // Insert children
  let inserted = 0;
  let skipped = 0;
  const contactsQueue: Array<{ childId: number; fecha: string; quien: string | null; obs: string | null }> = [];

  for (const n of ninos) {
    const roomId = roomIdMap[n.sala];
    if (roomId === undefined) { skipped++; continue; }
    try {
      const [child] = await db.insert(childrenTable).values({
        roomId,
        registro: n.reg ?? null,
        apellido: n.ap,
        nombre: n.nb,
        dni: n.dni ?? null,
        fnac: n.fnac ?? null,
        genero: n.genero ?? null,
        domicilio: n.dom ?? null,
        barrio: n.barrio ?? null,
        localidad: n.loc ?? null,
        famApellido: n.fam_ap ?? null,
        famNombre: n.fam_nb ?? null,
        vinculo: n.vinculo ?? null,
        celular: n.cel ?? null,
        email: n.email ?? null,
        estado: n.estado ?? "INSCRIPTX",
        estAsist: n.est_asist ?? "Regular",
        activo: n.activo !== false,
        inscripto: n.inscripto ?? null,
        fechaBaja: n.fechaBaja ?? null,
        motivoBaja: n.motivoBaja ?? null,
        tipoBaja: n.tipoBaja ?? null,
      }).returning();
      inserted++;
      if (n.llamados) {
        for (const ll of n.llamados) {
          contactsQueue.push({ childId: child.id, fecha: ll.fecha, quien: ll.quien ?? null, obs: ll.obs ?? null });
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Error inserting ${n.ap} ${n.nb}: ${msg}`);
      skipped++;
    }
  }
  console.log(`Children: ${inserted} inserted, ${skipped} skipped`);

  // Insert contacts from llamados (filter out entries with invalid dates)
  const validContacts = contactsQueue.filter(
    (c) => c.fecha && c.fecha.match(/^\d{4}-\d{2}-\d{2}$/)
  );
  if (validContacts.length > 0) {
    for (const c of validContacts) {
      try {
        await db.insert(contactsTable).values({
          childId: c.childId,
          fecha: c.fecha,
          quien: c.quien,
          motivo: "Consulta por ausencias",
          obs: c.obs,
          resultado: "Asiste",
        });
      } catch (_e) {
        // skip invalid
      }
    }
  }
  console.log(`Contacts: ${contactsQueue.length} inserted`);
  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
