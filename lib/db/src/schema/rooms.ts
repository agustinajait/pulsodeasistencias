import { pgTable, serial, integer, varchar, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { centersTable } from "./centers";

export const roomsTable = pgTable("rooms", {
  id: serial("id").primaryKey(),
  centerId: integer("center_id").notNull().references(() => centersTable.id),
  ecoNumber: integer("eco_number").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  capacity: integer("capacity").notNull(),
  checkInToken: varchar("check_in_token", { length: 64 }).unique(),
});

export const insertRoomSchema = createInsertSchema(roomsTable).omit({ id: true });
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof roomsTable.$inferSelect;
