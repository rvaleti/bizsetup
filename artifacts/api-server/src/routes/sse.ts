import { Router, type IRouter, type Request, type Response } from "express";
import { User } from "@workspace/db/schema";
import { requireAuth } from "../middlewares/requireAuth";
import { setBroadcastFn } from "../lib/notifications";

const router: IRouter = Router();

const clients = new Map<string, Set<Response>>();

setBroadcastFn(broadcastNotification);

export function broadcastNotification(userId: string, notification: object) {
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) return;

  const data = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`;
  for (const res of userClients) {
    try {
      res.write(data);
    } catch {
      userClients.delete(res);
    }
  }
}

function setupSSEConnection(req: Request, res: Response) {
  const actor = req.user as User;
  const userId = actor.id;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)!.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    const userClients = clients.get(userId);
    if (userClients) {
      userClients.delete(res);
      if (userClients.size === 0) {
        clients.delete(userId);
      }
    }
  });
}

router.get("/notifications/sse", requireAuth, setupSSEConnection);
router.get("/notifications/stream", requireAuth, setupSSEConnection);

export default router;
