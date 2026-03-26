import { pgTable, text, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { pipelinesTable } from "./pipelines";

export const notificationTypeEnum = pgEnum("notification_type", [
  "STATUS_CHANGE",
  "ASSIGNED",
  "COMMENT",
  "STEP_COMPLETE",
  "REJECTED",
  "RECTIFICATION",
  "SYSTEM",
]);

export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  pipelineId: text("pipeline_id").references(() => pipelinesTable.id, {
    onDelete: "cascade",
  }),
  type: notificationTypeEnum("type").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(
  notificationsTable
).omit({
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
