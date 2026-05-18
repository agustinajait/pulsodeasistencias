import { pgTable, serial, integer, varchar, boolean, date, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  fecha: date("fecha").notNull(),
  estado: varchar("estado", { length: 5 }),
  nota: text("nota"),
  motivo: varchar("motivo", { length: 100 }),
  mercaderia: boolean("mercaderia").notNull().default(false),
}, (t) => [
  unique().on(t.childId, t.fecha),
]);

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
