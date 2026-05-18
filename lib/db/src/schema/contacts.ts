import { pgTable, serial, integer, varchar, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { childrenTable } from "./children";

export const contactsTable = pgTable("contacts", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  fecha: date("fecha").notNull(),
  quien: varchar("quien", { length: 100 }),
  motivo: varchar("motivo", { length: 200 }),
  obs: text("obs"),
  resultado: varchar("resultado", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContactSchema = createInsertSchema(contactsTable).omit({ id: true, createdAt: true });
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contactsTable.$inferSelect;
