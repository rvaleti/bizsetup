import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pipelinesTable } from "./pipelines";
import { usersTable } from "./users";

export const eventTypeEnum = pgEnum("event_type", [
  "STATUS_CHANGE",
  "ASSIGNED",
  "COMMENT",
  "STEP_COMPLETE",
  "DOCUMENT_UPLOADED",
  "SYSTEM",
]);

export const pipelineEventsTable = pgTable("pipeline_events", {
  id: text("id").primaryKey(),
  pipelineId: text("pipeline_id")
    .notNull()
    .references(() => pipelinesTable.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  eventType: eventTypeEnum("event_type").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPipelineEventSchema = createInsertSchema(
  pipelineEventsTable
).omit({
  createdAt: true,
});

export type InsertPipelineEvent = z.infer<typeof insertPipelineEventSchema>;
export type PipelineEvent = typeof pipelineEventsTable.$inferSelect;
