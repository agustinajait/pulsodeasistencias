import { pgTable, serial, integer, varchar, boolean, text, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { roomsTable } from "./rooms";

export const childrenTable = pgTable("children", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => roomsTable.id),
  registro: varchar("registro", { length: 50 }),
  apellido: varchar("apellido", { length: 100 }).notNull(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  dni: varchar("dni", { length: 20 }),
  fnac: date("fnac"),
  genero: varchar("genero", { length: 20 }),
  domicilio: text("domicilio"),
  barrio: varchar("barrio", { length: 100 }),
  localidad: varchar("localidad", { length: 100 }),
  famApellido: varchar("fam_apellido", { length: 100 }),
  famNombre: varchar("fam_nombre", { length: 100 }),
  vinculo: varchar("vinculo", { length: 50 }),
  celular: varchar("celular", { length: 50 }),
  email: varchar("email", { length: 150 }),
  estado: varchar("estado", { length: 50 }).notNull().default("INSCRIPTX"),
  estAsist: varchar("est_asist", { length: 50 }),
  activo: boolean("activo").notNull().default(true),
  inscripto: date("inscripto"),
  obs: text("obs"),
  fechaBaja: date("fecha_baja"),
  motivoBaja: varchar("motivo_baja", { length: 200 }),
  tipoBaja: varchar("tipo_baja", { length: 50 }),
  docsToken: varchar("docs_token", { length: 64 }).unique(),
  panialesAuth: boolean("paniales_auth").default(false),
});

export const insertChildSchema = createInsertSchema(childrenTable).omit({ id: true });
export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof childrenTable.$inferSelect;
