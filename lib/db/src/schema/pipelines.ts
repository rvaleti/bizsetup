import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { usersTable } from "./users";

export const pipelineStatusEnum = pgEnum("pipeline_status", [
  "NEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING",
  "COMPLETED",
  "REJECTED",
  "RECTIFICATION",
]);

export const stepStatusEnum = pgEnum("step_status", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "SKIPPED",
]);

export const pipelinesTable = pgTable("pipelines", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  assignedFacilitatorId: text("assigned_facilitator_id").references(
    () => usersTable.id,
    { onDelete: "set null" }
  ),
  status: pipelineStatusEnum("status").notNull().default("NEW"),
  currentStep: text("current_step"),
  rejectionReason: text("rejection_reason"),
  rectificationNotes: text("rectification_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pipelineStepsTable = pgTable("pipeline_steps", {
  id: text("id").primaryKey(),
  pipelineId: text("pipeline_id")
    .notNull()
    .references(() => pipelinesTable.id, { onDelete: "cascade" }),
  stepKey: text("step_key").notNull(),
  stepName: text("step_name").notNull(),
  description: text("description"),
  status: stepStatusEnum("status").notNull().default("PENDING"),
  order: text("order").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: text("completed_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
});

export const insertPipelineSchema = createInsertSchema(pipelinesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertPipelineStepSchema = createInsertSchema(
  pipelineStepsTable
).omit({});

export type InsertPipeline = z.infer<typeof insertPipelineSchema>;
export type Pipeline = typeof pipelinesTable.$inferSelect;
export type InsertPipelineStep = z.infer<typeof insertPipelineStepSchema>;
export type PipelineStep = typeof pipelineStepsTable.$inferSelect;
