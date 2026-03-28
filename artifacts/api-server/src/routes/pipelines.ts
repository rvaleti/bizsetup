import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  pipelinesTable,
  pipelineStepsTable,
  pipelineEventsTable,
  companiesTable,
  usersTable,
  User,
} from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../middlewares/requireAuth";
import { createNotification } from "../lib/notifications";
import { DEFAULT_PIPELINE_STEPS } from "../lib/pipelineSteps";

const router: IRouter = Router();

type PipelineStatus = "NEW" | "ASSIGNED" | "IN_PROGRESS" | "WAITING" | "COMPLETED" | "REJECTED" | "RECTIFICATION";
type StepStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
type NotificationType = "STATUS_CHANGE" | "ASSIGNED" | "COMMENT" | "STEP_COMPLETE" | "REJECTED" | "RECTIFICATION" | "SYSTEM";

const VALID_TRANSITIONS: Record<PipelineStatus, PipelineStatus[]> = {
  NEW: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["WAITING", "COMPLETED", "REJECTED", "RECTIFICATION"],
  WAITING: ["IN_PROGRESS", "REJECTED", "RECTIFICATION"],
  RECTIFICATION: ["IN_PROGRESS", "REJECTED"],
  COMPLETED: [],
  REJECTED: [],
};

const VALID_PIPELINE_STATUSES = new Set<string>(Object.keys(VALID_TRANSITIONS));
const VALID_STEP_STATUSES = new Set<string>(["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED"]);

async function getPipelineDetail(pipelineId: string) {
  const [pipeline] = await db
    .select()
    .from(pipelinesTable)
    .where(eq(pipelinesTable.id, pipelineId))
    .limit(1);

  if (!pipeline) return null;

  const steps = await db
    .select()
    .from(pipelineStepsTable)
    .where(eq(pipelineStepsTable.pipelineId, pipelineId))
    .orderBy(asc(pipelineStepsTable.order));

  const events = await db
    .select({
      event: pipelineEventsTable,
      actor: usersTable,
    })
    .from(pipelineEventsTable)
    .leftJoin(usersTable, eq(pipelineEventsTable.actorId, usersTable.id))
    .where(eq(pipelineEventsTable.pipelineId, pipelineId))
    .orderBy(asc(pipelineEventsTable.createdAt));

  const eventsWithActors = events.map(({ event, actor }) => ({
    ...event,
    actor: actor ?? null,
  }));

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, pipeline.companyId))
    .limit(1);

  const [customer] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, company?.customerId ?? ""))
    .limit(1);

  let facilitator = null;
  if (pipeline.assignedFacilitatorId) {
    const [f] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, pipeline.assignedFacilitatorId))
      .limit(1);
    facilitator = f ?? null;
  }

  return {
    ...pipeline,
    assignedFacilitator: facilitator,
    steps,
    events: eventsWithActors,
    company: company ?? null,
    customer: customer ?? null,
  };
}

async function canAccessPipeline(actor: User, pipeline: typeof pipelinesTable.$inferSelect): Promise<boolean> {
  if (actor.role === "ADMIN") return true;
  if (actor.role === "FACILITATOR" && pipeline.assignedFacilitatorId === actor.id) return true;
  if (actor.role === "CUSTOMER") {
    const [company] = await db
      .select()
      .from(companiesTable)
      .where(and(eq(companiesTable.id, pipeline.companyId), eq(companiesTable.customerId, actor.id)))
      .limit(1);
    return !!company;
  }
  return false;
}

router.post("/pipelines", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { companyId } = req.body as { companyId: string };

  if (!companyId) {
    res.status(422).json({ error: "VALIDATION_ERROR", message: "companyId is required" });
    return;
  }

  try {
    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);

    if (!company) {
      res.status(404).json({ error: "NOT_FOUND", message: "Company not found" });
      return;
    }

    if (actor.role === "CUSTOMER" && company.customerId !== actor.id) {
      res.status(403).json({ error: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const pipelineId = randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(pipelinesTable).values({
        id: pipelineId,
        companyId,
        status: "NEW",
        currentStep: DEFAULT_PIPELINE_STEPS[0].stepKey,
      });

      const stepValues = DEFAULT_PIPELINE_STEPS.map((step) => ({
        id: randomUUID(),
        pipelineId,
        stepKey: step.stepKey,
        stepName: step.stepName,
        description: step.description,
        order: step.order,
        status: "PENDING" as const,
      }));

      await tx.insert(pipelineStepsTable).values(stepValues);
    });

    const detail = await getPipelineDetail(pipelineId);
    res.status(201).json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to create pipeline");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to create pipeline" });
  }
});

router.get("/pipelines/:pipelineId", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { pipelineId } = req.params as Record<string, string>;

  try {
    const [pipeline] = await db
      .select()
      .from(pipelinesTable)
      .where(eq(pipelinesTable.id, pipelineId))
      .limit(1);

    if (!pipeline) {
      res.status(404).json({ error: "NOT_FOUND", message: "Pipeline not found" });
      return;
    }

    const hasAccess = await canAccessPipeline(actor, pipeline);
    if (!hasAccess) {
      res.status(403).json({ error: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const detail = await getPipelineDetail(pipelineId);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to get pipeline");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to get pipeline" });
  }
});

router.patch("/pipelines/:pipelineId/status", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { pipelineId } = req.params as Record<string, string>;
  const { status, message, rejectionReason, rectificationNotes } = req.body as {
    status: string;
    message?: string;
    rejectionReason?: string;
    rectificationNotes?: string;
  };

  if (!status) {
    res.status(422).json({ error: "VALIDATION_ERROR", message: "status is required" });
    return;
  }

  if (!VALID_PIPELINE_STATUSES.has(status)) {
    res.status(422).json({ error: "VALIDATION_ERROR", message: `Invalid status: ${status}` });
    return;
  }

  const newStatus = status as PipelineStatus;

  try {
    const [pipeline] = await db
      .select()
      .from(pipelinesTable)
      .where(eq(pipelinesTable.id, pipelineId))
      .limit(1);

    if (!pipeline) {
      res.status(404).json({ error: "NOT_FOUND", message: "Pipeline not found" });
      return;
    }

    const hasAccess = await canAccessPipeline(actor, pipeline);
    if (!hasAccess) {
      res.status(403).json({ error: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const allowed = VALID_TRANSITIONS[pipeline.status] ?? [];
    if (!allowed.includes(newStatus)) {
      res.status(422).json({
        error: "INVALID_TRANSITION",
        message: `Cannot transition from ${pipeline.status} to ${newStatus}`,
      });
      return;
    }

    if (newStatus === "REJECTED" && actor.role !== "ADMIN") {
      res.status(403).json({ error: "FORBIDDEN", message: "Only admin can reject a pipeline" });
      return;
    }

    await db.update(pipelinesTable).set({
      status: newStatus,
      updatedAt: new Date(),
      ...(rejectionReason ? { rejectionReason } : {}),
      ...(rectificationNotes ? { rectificationNotes } : {}),
    }).where(eq(pipelinesTable.id, pipelineId));

    await db.insert(pipelineEventsTable).values({
      id: randomUUID(),
      pipelineId,
      actorId: actor.id,
      eventType: "STATUS_CHANGE",
      previousStatus: pipeline.status,
      newStatus,
      message: message ?? `Status changed from ${pipeline.status} to ${newStatus}`,
    });

    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, pipeline.companyId))
      .limit(1);

    const notifType: NotificationType = newStatus === "REJECTED" ? "REJECTED" : newStatus === "RECTIFICATION" ? "RECTIFICATION" : "STATUS_CHANGE";
    const notifMessage = `Pipeline for ${company?.name ?? "your company"} moved to ${newStatus}`;

    if (company?.customerId) {
      await createNotification({
        userId: company.customerId,
        pipelineId,
        type: notifType,
        message: notifMessage,
      });
    }

    if (pipeline.assignedFacilitatorId && pipeline.assignedFacilitatorId !== actor.id) {
      await createNotification({
        userId: pipeline.assignedFacilitatorId,
        pipelineId,
        type: notifType,
        message: notifMessage,
      });
    }

    const detail = await getPipelineDetail(pipelineId);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to update pipeline status");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to update pipeline status" });
  }
});

router.post("/pipelines/:pipelineId/assign", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { pipelineId } = req.params as Record<string, string>;
  const { facilitatorId, message } = req.body as { facilitatorId: string; message?: string };

  if (actor.role !== "ADMIN") {
    res.status(403).json({ error: "FORBIDDEN", message: "Only admin can assign facilitators" });
    return;
  }

  if (!facilitatorId) {
    res.status(422).json({ error: "VALIDATION_ERROR", message: "facilitatorId is required" });
    return;
  }

  try {
    const [pipeline] = await db
      .select()
      .from(pipelinesTable)
      .where(eq(pipelinesTable.id, pipelineId))
      .limit(1);

    if (!pipeline) {
      res.status(404).json({ error: "NOT_FOUND", message: "Pipeline not found" });
      return;
    }

    const [facilitator] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, facilitatorId), eq(usersTable.role, "FACILITATOR")))
      .limit(1);

    if (!facilitator) {
      res.status(404).json({ error: "NOT_FOUND", message: "Facilitator not found" });
      return;
    }

    await db
      .update(pipelinesTable)
      .set({
        assignedFacilitatorId: facilitatorId,
        status: "ASSIGNED",
        updatedAt: new Date(),
      })
      .where(eq(pipelinesTable.id, pipelineId));

    await db.insert(pipelineEventsTable).values({
      id: randomUUID(),
      pipelineId,
      actorId: actor.id,
      eventType: "ASSIGNED",
      previousStatus: pipeline.status,
      newStatus: "ASSIGNED",
      message: message ?? `Assigned to ${facilitator.name}`,
    });

    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, pipeline.companyId))
      .limit(1);

    await createNotification({
      userId: facilitatorId,
      pipelineId,
      type: "ASSIGNED",
      message: `Pipeline for ${company?.name ?? "company"} assigned to you`,
    });

    if (company?.customerId) {
      await createNotification({
        userId: company.customerId,
        pipelineId,
        type: "ASSIGNED",
        message: `${facilitator.name} has been assigned to your company registration`,
      });
    }

    const detail = await getPipelineDetail(pipelineId);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to assign facilitator");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to assign facilitator" });
  }
});

router.patch("/pipelines/:pipelineId/steps/:stepId", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { pipelineId, stepId } = req.params as Record<string, string>;
  const { status } = req.body as { status: string };

  if (!status) {
    res.status(422).json({ error: "VALIDATION_ERROR", message: "status is required" });
    return;
  }

  if (!VALID_STEP_STATUSES.has(status)) {
    res.status(422).json({ error: "VALIDATION_ERROR", message: `Invalid step status: ${status}` });
    return;
  }

  const newStepStatus = status as StepStatus;

  try {
    const [pipeline] = await db
      .select()
      .from(pipelinesTable)
      .where(eq(pipelinesTable.id, pipelineId))
      .limit(1);

    if (!pipeline) {
      res.status(404).json({ error: "NOT_FOUND", message: "Pipeline not found" });
      return;
    }

    const hasAccess = await canAccessPipeline(actor, pipeline);
    if (!hasAccess) {
      res.status(403).json({ error: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const [step] = await db
      .select()
      .from(pipelineStepsTable)
      .where(and(eq(pipelineStepsTable.id, stepId), eq(pipelineStepsTable.pipelineId, pipelineId)))
      .limit(1);

    if (!step) {
      res.status(404).json({ error: "NOT_FOUND", message: "Step not found" });
      return;
    }

    if (newStepStatus === "COMPLETED") {
      await db
        .update(pipelineStepsTable)
        .set({ status: newStepStatus, completedAt: new Date(), completedBy: actor.id })
        .where(eq(pipelineStepsTable.id, stepId));

      await db.insert(pipelineEventsTable).values({
        id: randomUUID(),
        pipelineId,
        actorId: actor.id,
        eventType: "STEP_COMPLETE",
        message: `Step "${step.stepName}" marked as completed`,
      });

      const allSteps = await db
        .select()
        .from(pipelineStepsTable)
        .where(eq(pipelineStepsTable.pipelineId, pipelineId));

      const allDone = allSteps.every(
        (s) => s.id === stepId ? true : s.status === "COMPLETED" || s.status === "SKIPPED"
      );

      if (allDone) {
        await db.insert(pipelineEventsTable).values({
          id: randomUUID(),
          pipelineId,
          actorId: null,
          eventType: "SYSTEM",
          message: "All steps completed. Pipeline is ready for completion.",
        });
      } else {
        const nextStep = allSteps.find(
          (s) => s.id !== stepId && s.status === "PENDING"
        );
        if (nextStep) {
          await db
            .update(pipelinesTable)
            .set({ currentStep: nextStep.stepKey, updatedAt: new Date() })
            .where(eq(pipelinesTable.id, pipelineId));
        }
      }

      const [company] = await db
        .select()
        .from(companiesTable)
        .where(eq(companiesTable.id, pipeline.companyId))
        .limit(1);

      if (company?.customerId) {
        await createNotification({
          userId: company.customerId,
          pipelineId,
          type: "STEP_COMPLETE",
          message: `Step "${step.stepName}" completed for ${company.name}`,
        });
      }
    } else {
      await db
        .update(pipelineStepsTable)
        .set({ status: newStepStatus })
        .where(eq(pipelineStepsTable.id, stepId));
    }

    const [updatedStep] = await db
      .select()
      .from(pipelineStepsTable)
      .where(eq(pipelineStepsTable.id, stepId))
      .limit(1);

    res.json(updatedStep);
  } catch (err) {
    req.log.error({ err }, "Failed to update step");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to update step" });
  }
});

export default router;
