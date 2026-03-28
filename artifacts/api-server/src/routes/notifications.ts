import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable, User } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { unreadOnly = "true", page = "1", pageSize = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (pageNum - 1) * pageSizeNum;

  try {
    const conditions = [eq(notificationsTable.userId, actor.id)];
    if (unreadOnly === "true") {
      conditions.push(eq(notificationsTable.read, false));
    }
    const whereClause = and(...conditions);

    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(whereClause)
      .orderBy(desc(notificationsTable.createdAt))
      .limit(pageSizeNum)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(whereClause);

    const [{ unreadCount }] = await db
      .select({ unreadCount: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, actor.id), eq(notificationsTable.read, false)));

    res.json({
      data: notifications,
      total: count,
      unreadCount,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(count / pageSizeNum),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list notifications");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to list notifications" });
  }
});

router.patch("/notifications/read-all", requireAuth, async (req, res) => {
  const actor = req.user as User;

  try {
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.userId, actor.id), eq(notificationsTable.read, false)));

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    req.log.error({ err }, "Failed to mark all notifications read");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to mark notifications read" });
  }
});

router.patch("/notifications/:notificationId/read", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { notificationId } = req.params as Record<string, string>;

  try {
    const [notification] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, notificationId))
      .limit(1);

    if (!notification) {
      res.status(404).json({ error: "NOT_FOUND", message: "Notification not found" });
      return;
    }

    if (notification.userId !== actor.id) {
      res.status(403).json({ error: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const [updated] = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.id, notificationId))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to mark notification read");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to mark notification read" });
  }
});

export default router;
