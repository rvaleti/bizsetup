import { relations } from "drizzle-orm";
import { usersTable } from "./users";
import { companiesTable } from "./companies";
import { pipelinesTable, pipelineStepsTable } from "./pipelines";
import { pipelineEventsTable } from "./events";
import { notificationsTable } from "./notifications";

export const usersRelations = relations(usersTable, ({ many }) => ({
  companies: many(companiesTable),
  assignedPipelines: many(pipelinesTable),
  pipelineEvents: many(pipelineEventsTable),
  notifications: many(notificationsTable),
  completedSteps: many(pipelineStepsTable),
}));

export const companiesRelations = relations(companiesTable, ({ one, many }) => ({
  customer: one(usersTable, {
    fields: [companiesTable.customerId],
    references: [usersTable.id],
  }),
  pipelines: many(pipelinesTable),
}));

export const pipelinesRelations = relations(pipelinesTable, ({ one, many }) => ({
  company: one(companiesTable, {
    fields: [pipelinesTable.companyId],
    references: [companiesTable.id],
  }),
  assignedFacilitator: one(usersTable, {
    fields: [pipelinesTable.assignedFacilitatorId],
    references: [usersTable.id],
  }),
  steps: many(pipelineStepsTable),
  events: many(pipelineEventsTable),
  notifications: many(notificationsTable),
}));

export const pipelineStepsRelations = relations(pipelineStepsTable, ({ one }) => ({
  pipeline: one(pipelinesTable, {
    fields: [pipelineStepsTable.pipelineId],
    references: [pipelinesTable.id],
  }),
  completedByUser: one(usersTable, {
    fields: [pipelineStepsTable.completedBy],
    references: [usersTable.id],
  }),
}));

export const pipelineEventsRelations = relations(pipelineEventsTable, ({ one }) => ({
  pipeline: one(pipelinesTable, {
    fields: [pipelineEventsTable.pipelineId],
    references: [pipelinesTable.id],
  }),
  actor: one(usersTable, {
    fields: [pipelineEventsTable.actorId],
    references: [usersTable.id],
  }),
}));

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [notificationsTable.userId],
    references: [usersTable.id],
  }),
  pipeline: one(pipelinesTable, {
    fields: [notificationsTable.pipelineId],
    references: [pipelinesTable.id],
  }),
}));
