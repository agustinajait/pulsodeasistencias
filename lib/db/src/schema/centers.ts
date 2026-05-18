import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const centersTable = pgTable("centers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
});

export const insertCenterSchema = createInsertSchema(centersTable).omit({ id: true });
export type InsertCenter = z.infer<typeof insertCenterSchema>;
export type Center = typeof centersTable.$inferSelect;
