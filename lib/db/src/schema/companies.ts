import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const entityTypeEnum = pgEnum("entity_type", [
  "LLP",
  "PRIVATE_LIMITED",
  "OPC",
  "PARTNERSHIP",
  "SOLE_PROPRIETORSHIP",
  "SECTION_8",
  "PUBLIC_LIMITED",
]);

export const companiesTable = pgTable("companies", {
  id: text("id").primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  entityType: entityTypeEnum("entity_type").notNull(),
  primaryPhone: text("primary_phone").notNull(),
  alternatePhone: text("alternate_phone"),
  email: text("email"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
