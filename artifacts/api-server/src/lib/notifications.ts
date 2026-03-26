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

export async function createNotification(params: {
  userId: string;
  pipelineId?: string;
  type: NotificationType;
  message: string;
}): Promise<void> {
  try {
    await db.insert(notificationsTable).values({
      id: randomUUID(),
      userId: params.userId,
      pipelineId: params.pipelineId ?? null,
      type: params.type,
      message: params.message,
      read: false,
    });
  } catch (err) {
    logger.error({ err, ...params }, "Failed to create notification");
  }
}
