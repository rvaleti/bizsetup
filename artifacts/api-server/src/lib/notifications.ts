import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";
import { logger } from "./logger";

export type NotificationType =
  | "STATUS_CHANGE"
  | "ASSIGNED"
  | "COMMENT"
  | "STEP_COMPLETE"
  | "REJECTED"
  | "RECTIFICATION"
  | "SYSTEM";

type BroadcastFn = (userId: string, notification: object) => void;

let _broadcast: BroadcastFn | null = null;

export function setBroadcastFn(fn: BroadcastFn) {
  _broadcast = fn;
}

export async function createNotification(params: {
  userId: string;
  pipelineId?: string;
  type: NotificationType;
  message: string;
}): Promise<void> {
  if (!params.userId) return;

  try {
    const id = randomUUID();
    const [notification] = await db
      .insert(notificationsTable)
      .values({
        id,
        userId: params.userId,
        pipelineId: params.pipelineId ?? null,
        type: params.type,
        message: params.message,
        read: false,
      })
      .returning();

    if (_broadcast && notification) {
      _broadcast(params.userId, notification);
    }
  } catch (err) {
    logger.error({ err, ...params }, "Failed to create notification");
  }
}
