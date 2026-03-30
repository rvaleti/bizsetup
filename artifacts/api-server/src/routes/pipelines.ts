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
import { eq, and, asc, sql } from "drizzle-orm";
import { safeUserFields, SafeUser } from "../lib/safeUser";
import { randomUUID } from "crypto";
import { requireAuth } from "../middlewares/requireAuth";
import { createNotification } from "../lib/notifications";
import { sendMoreInfoEmail } from "../lib/mailer";
import { DEFAULT_PIPELINE_STEPS, DYNAMIC_STEP_TEMPLATES } from "../lib/pipelineSteps";

const router: IRouter = Router();

type PipelineStatus =
  | "NEW"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING"
  | "COMPLETED"
  | "REJECTED"
  | "RECTIFICATION"
  | "RE_SUBMITTED";

type StepStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "WAITING";
type NotificationType = "STATUS_CHANGE" | "ASSIGNED" | "COMMENT" | "STEP_COMPLETE" | "REJECTED" | "RECTIFICATION" | "SYSTEM" | "NEW_REGISTRATION" | "MORE_INFO_REQUIRED";

const VALID_TRANSITIONS: Record<PipelineStatus, PipelineStatus[]> = {
  NEW: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["WAITING", "COMPLETED", "REJECTED", "RECTIFICATION"],
  WAITING: ["IN_PROGRESS", "REJECTED", "RECTIFICATION", "RE_SUBMITTED"],
  RECTIFICATION: ["IN_PROGRESS", "WAITING", "REJECTED", "RE_SUBMITTED"],
  RE_SUBMITTED: ["WAITING", "IN_PROGRESS", "REJECTED", "COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
};

const VALID_PIPELINE_STATUSES = new Set<string>(Object.keys(VALID_TRANSITIONS));
const VALID_STEP_STATUSES = new Set<string>(["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED", "WAITING"]);

const STEP_TRIGGERS_WAITING = new Set(["gst_filing", "govt_registration"]);
const STEP_TRIGGERS_COMPLETED = new Set(["company_registered"]);

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

  const eventRows = await db
    .select({
      event: pipelineEventsTable,
      actor: safeUserFields,
    })
    .from(pipelineEventsTable)
    .leftJoin(usersTable, eq(pipelineEventsTable.actorId, usersTable.id))
    .where(eq(pipelineEventsTable.pipelineId, pipelineId))
    .orderBy(asc(pipelineEventsTable.createdAt));

  const eventsWithActors = eventRows.map(({ event, actor }) => ({
    ...event,
    actor: actor?.id ? actor : null,
  }));

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, pipeline.companyId))
    .limit(1);

  let customer: SafeUser | null = null;
  if (company?.customerId) {
    const [c] = await db
      .select(safeUserFields)
      .from(usersTable)
      .where(eq(usersTable.id, company.customerId))
      .limit(1);
    customer = c ?? null;
  }

  let facilitator: SafeUser | null = null;
  if (pipeline.assignedFacilitatorId) {
    const [f] = await db
      .select(safeUserFields)
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
    customer,
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
        assignedTo: step.assignedTo,
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

    if (actor.role === "CUSTOMER") {
      res.status(403).json({ error: "FORBIDDEN", message: "Customers cannot modify pipeline status" });
      return;
    }

    const allowed = VALID_TRANSITIONS[pipeline.status as PipelineStatus] ?? [];
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
      await createNotification({ userId: company.customerId, pipelineId, type: notifType, message: notifMessage });
    }

    if (pipeline.assignedFacilitatorId && pipeline.assignedFacilitatorId !== actor.id) {
      await createNotification({ userId: pipeline.assignedFacilitatorId, pipelineId, type: notifType, message: notifMessage });
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

    const TERMINAL_STATES: PipelineStatus[] = ["COMPLETED", "REJECTED"];
    if (TERMINAL_STATES.includes(pipeline.status as PipelineStatus)) {
      res.status(422).json({
        error: "INVALID_TRANSITION",
        message: `Cannot assign facilitator to a pipeline in ${pipeline.status} state`,
      });
      return;
    }

    const [facilitator] = await db
      .select(safeUserFields)
      .from(usersTable)
      .where(and(eq(usersTable.id, facilitatorId), eq(usersTable.role, "FACILITATOR")))
      .limit(1);

    if (!facilitator) {
      res.status(404).json({ error: "NOT_FOUND", message: "Facilitator not found" });
      return;
    }

    await db
      .update(pipelinesTable)
      .set({ assignedFacilitatorId: facilitatorId, status: "ASSIGNED", updatedAt: new Date() })
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

    if (actor.role === "CUSTOMER") {
      res.status(403).json({ error: "FORBIDDEN", message: "Customers cannot modify pipeline steps" });
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

    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, pipeline.companyId))
      .limit(1);

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

      if (STEP_TRIGGERS_WAITING.has(step.stepKey)) {
        await db.update(pipelinesTable).set({ status: "WAITING", updatedAt: new Date() }).where(eq(pipelinesTable.id, pipelineId));
        await db.insert(pipelineEventsTable).values({
          id: randomUUID(),
          pipelineId,
          actorId: null,
          eventType: "STATUS_CHANGE",
          previousStatus: pipeline.status,
          newStatus: "WAITING",
          message: `Pipeline moved to WAITING — pending government response for step "${step.stepName}"`,
        });
        if (company?.customerId) {
          await createNotification({
            userId: company.customerId,
            pipelineId,
            type: "STATUS_CHANGE",
            message: `Step "${step.stepName}" filed and is now awaiting government response for ${company.name}`,
          });
        }
      } else if (STEP_TRIGGERS_COMPLETED.has(step.stepKey)) {
        await db.update(pipelinesTable).set({ status: "COMPLETED", updatedAt: new Date() }).where(eq(pipelinesTable.id, pipelineId));
        await db.insert(pipelineEventsTable).values({
          id: randomUUID(),
          pipelineId,
          actorId: null,
          eventType: "STATUS_CHANGE",
          previousStatus: pipeline.status,
          newStatus: "COMPLETED",
          message: `Company registration completed successfully!`,
        });
        if (company?.customerId) {
          await createNotification({
            userId: company.customerId,
            pipelineId,
            type: "STATUS_CHANGE",
            message: `Great news! ${company.name} has been successfully registered!`,
          });
        }
        if (pipeline.assignedFacilitatorId) {
          await createNotification({
            userId: pipeline.assignedFacilitatorId,
            pipelineId,
            type: "STATUS_CHANGE",
            message: `Pipeline for ${company?.name ?? "company"} marked as COMPLETED`,
          });
        }
      } else {
        const allSteps = await db
          .select()
          .from(pipelineStepsTable)
          .where(eq(pipelineStepsTable.pipelineId, pipelineId));

        const nextStep = allSteps.find((s) => s.id !== stepId && s.status === "PENDING");
        if (nextStep) {
          await db.update(pipelinesTable).set({ currentStep: nextStep.stepKey, updatedAt: new Date() }).where(eq(pipelinesTable.id, pipelineId));
        }

        if (company?.customerId) {
          await createNotification({
            userId: company.customerId,
            pipelineId,
            type: "STEP_COMPLETE",
            message: `Step "${step.stepName}" completed for ${company.name}`,
          });
        }
      }
    } else {
      await db
        .update(pipelineStepsTable)
        .set({ status: newStepStatus })
        .where(eq(pipelineStepsTable.id, stepId));

      if (newStepStatus === "IN_PROGRESS") {
        await db.update(pipelinesTable).set({
          currentStep: step.stepKey,
          status: pipeline.status === "ASSIGNED" ? "IN_PROGRESS" : pipeline.status,
          updatedAt: new Date(),
        }).where(eq(pipelinesTable.id, pipelineId));
      }
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

router.post("/pipelines/:pipelineId/more-info", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { pipelineId } = req.params as Record<string, string>;
  const { details } = req.body as { details: string };

  if (actor.role !== "FACILITATOR" && actor.role !== "ADMIN") {
    res.status(403).json({ error: "FORBIDDEN", message: "Only facilitators or admin can request more info" });
    return;
  }

  if (!details?.trim()) {
    res.status(422).json({ error: "VALIDATION_ERROR", message: "Details of what is required must be provided" });
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

    const hasAccess = await canAccessPipeline(actor, pipeline);
    if (!hasAccess) {
      res.status(403).json({ error: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const TERMINAL: PipelineStatus[] = ["COMPLETED", "REJECTED"];
    if (TERMINAL.includes(pipeline.status as PipelineStatus)) {
      res.status(422).json({ error: "INVALID_STATE", message: "Cannot request info on a completed or rejected pipeline" });
      return;
    }

    const existingSteps = await db
      .select()
      .from(pipelineStepsTable)
      .where(eq(pipelineStepsTable.pipelineId, pipelineId))
      .orderBy(asc(pipelineStepsTable.order));

    const maxOrder = existingSteps.reduce((max, s) => {
      const n = parseInt(s.order, 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);

    const newStepOrder = String(maxOrder + 1).padStart(2, "0");
    const template = DYNAMIC_STEP_TEMPLATES.more_info_required;

    const [newStep] = await db
      .insert(pipelineStepsTable)
      .values({
        id: randomUUID(),
        pipelineId,
        stepKey: `${template.stepKey}_${Date.now()}`,
        stepName: template.stepName,
        description: `${template.description}\n\nDetails requested: ${details}`,
        order: newStepOrder,
        status: "IN_PROGRESS",
        assignedTo: "CUSTOMER",
      })
      .returning();

    await db.insert(pipelineEventsTable).values({
      id: randomUUID(),
      pipelineId,
      actorId: actor.id,
      eventType: "SYSTEM",
      message: `More information requested from customer: ${details}`,
    });

    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, pipeline.companyId))
      .limit(1);

    let customerEmail = "";
    let customerName = "";

    if (company?.customerId) {
      await createNotification({
        userId: company.customerId,
        pipelineId,
        type: "MORE_INFO_REQUIRED",
        message: `Your facilitator has requested more information for ${company.name}: ${details}`,
      });

      const [customer] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, company.customerId))
        .limit(1);

      if (customer) {
        customerEmail = customer.email;
        customerName = customer.name;
      }
    }

    if (customerEmail) {
      await sendMoreInfoEmail({
        customerEmail,
        customerName,
        companyName: company?.name ?? "your company",
        facilitatorName: actor.name,
        details,
        pipelineId,
        appUrl: process.env.FRONTEND_URL,
      });
    }

    res.status(201).json({ step: newStep, message: "More info request sent to customer" });
  } catch (err) {
    req.log.error({ err }, "Failed to create more-info step");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to request more information" });
  }
});

router.post("/pipelines/:pipelineId/rectify", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { pipelineId } = req.params as Record<string, string>;
  const { notes } = req.body as { notes: string };

  if (actor.role !== "FACILITATOR" && actor.role !== "ADMIN") {
    res.status(403).json({ error: "FORBIDDEN", message: "Only facilitators or admin can raise rectification" });
    return;
  }

  if (!notes?.trim()) {
    res.status(422).json({ error: "VALIDATION_ERROR", message: "Rectification notes must be provided" });
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

    const hasAccess = await canAccessPipeline(actor, pipeline);
    if (!hasAccess) {
      res.status(403).json({ error: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const TERMINAL: PipelineStatus[] = ["COMPLETED", "REJECTED"];
    if (TERMINAL.includes(pipeline.status as PipelineStatus)) {
      res.status(422).json({ error: "INVALID_STATE", message: "Cannot rectify a completed or rejected pipeline" });
      return;
    }

    const existingSteps = await db
      .select()
      .from(pipelineStepsTable)
      .where(eq(pipelineStepsTable.pipelineId, pipelineId))
      .orderBy(asc(pipelineStepsTable.order));

    const maxOrder = existingSteps.reduce((max, s) => {
      const n = parseInt(s.order, 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);

    const newStepOrder = String(maxOrder + 1).padStart(2, "0");
    const template = DYNAMIC_STEP_TEMPLATES.rectification;

    const [newStep] = await db
      .insert(pipelineStepsTable)
      .values({
        id: randomUUID(),
        pipelineId,
        stepKey: `${template.stepKey}_${Date.now()}`,
        stepName: template.stepName,
        description: `${template.description}\n\nQuery received: ${notes}`,
        order: newStepOrder,
        status: "IN_PROGRESS",
        assignedTo: "FACILITATOR",
      })
      .returning();

    await db.update(pipelinesTable).set({
      status: "RECTIFICATION",
      rectificationNotes: notes,
      updatedAt: new Date(),
    }).where(eq(pipelinesTable.id, pipelineId));

    await db.insert(pipelineEventsTable).values({
      id: randomUUID(),
      pipelineId,
      actorId: actor.id,
      eventType: "STATUS_CHANGE",
      previousStatus: pipeline.status,
      newStatus: "RECTIFICATION",
      message: `Query received from government — rectification required: ${notes}`,
    });

    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, pipeline.companyId))
      .limit(1);

    if (company?.customerId) {
      await createNotification({
        userId: company.customerId,
        pipelineId,
        type: "RECTIFICATION",
        message: `A government query has been raised for ${company.name}. Facilitator is working on rectification.`,
      });
    }

    res.status(201).json({
      step: newStep,
      pipelineStatus: "RECTIFICATION",
      message: "Rectification step created and pipeline moved to RECTIFICATION status",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create rectification step");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to create rectification step" });
  }
});

router.post("/pipelines/:pipelineId/resubmit", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { pipelineId } = req.params as Record<string, string>;

  if (actor.role !== "FACILITATOR" && actor.role !== "ADMIN") {
    res.status(403).json({ error: "FORBIDDEN", message: "Only facilitators or admin can mark re-submission" });
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

    const hasAccess = await canAccessPipeline(actor, pipeline);
    if (!hasAccess) {
      res.status(403).json({ error: "FORBIDDEN", message: "Access denied" });
      return;
    }

    if (pipeline.status !== "RECTIFICATION") {
      res.status(422).json({ error: "INVALID_STATE", message: "Pipeline must be in RECTIFICATION state to resubmit" });
      return;
    }

    await db.update(pipelinesTable).set({
      status: "RE_SUBMITTED",
      updatedAt: new Date(),
    }).where(eq(pipelinesTable.id, pipelineId));

    await db.insert(pipelineEventsTable).values({
      id: randomUUID(),
      pipelineId,
      actorId: actor.id,
      eventType: "STATUS_CHANGE",
      previousStatus: "RECTIFICATION",
      newStatus: "RE_SUBMITTED",
      message: `Application re-submitted to government after rectification`,
    });

    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, pipeline.companyId))
      .limit(1);

    if (company?.customerId) {
      await createNotification({
        userId: company.customerId,
        pipelineId,
        type: "STATUS_CHANGE",
        message: `Good news! The rectified application for ${company.name} has been re-submitted to the government. Awaiting approval.`,
      });
    }

    const detail = await getPipelineDetail(pipelineId);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to mark re-submission");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to mark re-submission" });
  }
});

export default router;
