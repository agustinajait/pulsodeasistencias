import { pgTable, serial, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { centersTable } from "./centers";

export const orgUsersTable = pgTable("org_users", {
  id: serial("id").primaryKey(),
  centerId: integer("center_id").notNull().references(() => centersTable.id),
  email: varchar("email", { length: 200 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 200 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OrgUser = typeof orgUsersTable.$inferSelect;
