import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  pipelineEventsTable,
  pipelinesTable,
  companiesTable,
  usersTable,
  User,
} from "@workspace/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../middlewares/requireAuth";
import { createNotification } from "../lib/notifications";

const router: IRouter = Router();

async function canAccessPipeline(actor: User, pipelineId: string): Promise<boolean> {
  const [pipeline] = await db
    .select()
    .from(pipelinesTable)
    .where(eq(pipelinesTable.id, pipelineId))
    .limit(1);

  if (!pipeline) return false;
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

router.get("/pipelines/:pipelineId/events", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { pipelineId } = req.params as Record<string, string>;
  const { page = "1", pageSize = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 50));
  const offset = (pageNum - 1) * pageSizeNum;

  try {
    const hasAccess = await canAccessPipeline(actor, pipelineId);
    if (!hasAccess) {
      res.status(403).json({ error: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const events = await db
      .select()
      .from(pipelineEventsTable)
      .where(eq(pipelineEventsTable.pipelineId, pipelineId))
      .orderBy(desc(pipelineEventsTable.createdAt))
      .limit(pageSizeNum)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pipelineEventsTable)
      .where(eq(pipelineEventsTable.pipelineId, pipelineId));

    const actorIds = [...new Set(events.map((e) => e.actorId).filter(Boolean) as string[])];

    const actors =
      actorIds.length > 0
        ? await db.select().from(usersTable).where(inArray(usersTable.id, actorIds))
        : [];
    const actorMap = new Map(actors.map((u) => [u.id, u]));

    const enrichedEvents = events.map((event) => ({
      ...event,
      actor: event.actorId ? (actorMap.get(event.actorId) ?? null) : null,
    }));

    res.json({
      data: enrichedEvents,
      total: count,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(count / pageSizeNum),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list events");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to list events" });
  }
});

router.post("/pipelines/:pipelineId/events", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { pipelineId } = req.params as Record<string, string>;
  const { message } = req.body as { message: string };

  if (!message?.trim()) {
    res.status(422).json({ error: "VALIDATION_ERROR", message: "message is required" });
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

    const hasAccess = await canAccessPipeline(actor, pipelineId);
    if (!hasAccess) {
      res.status(403).json({ error: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const eventId = randomUUID();
    await db.insert(pipelineEventsTable).values({
      id: eventId,
      pipelineId,
      actorId: actor.id,
      eventType: "COMMENT",
      message: message.trim(),
    });

    const [event] = await db
      .select()
      .from(pipelineEventsTable)
      .where(eq(pipelineEventsTable.id, eventId))
      .limit(1);

    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, pipeline.companyId))
      .limit(1);

    const notifMessage = `${actor.name} commented on ${company?.name ?? "your pipeline"}`;

    if (actor.role !== "CUSTOMER" && company?.customerId) {
      await createNotification({
        userId: company.customerId,
        pipelineId,
        type: "COMMENT",
        message: notifMessage,
      });
    }

    if (actor.role !== "FACILITATOR" && pipeline.assignedFacilitatorId) {
      await createNotification({
        userId: pipeline.assignedFacilitatorId,
        pipelineId,
        type: "COMMENT",
        message: notifMessage,
      });
    }

    res.status(201).json({ ...event, actor });
  } catch (err) {
    req.log.error({ err }, "Failed to post comment");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to post comment" });
  }
});

export default router;
