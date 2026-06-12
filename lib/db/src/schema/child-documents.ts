import { pgTable, serial, integer, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { childrenTable } from "./children";

export const childDocumentsTable = pgTable("child_documents", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  tipo: varchar("tipo", { length: 50 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (t) => [unique().on(t.childId, t.tipo)]);

export type ChildDocument = typeof childDocumentsTable.$inferSelect;
