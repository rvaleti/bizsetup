import { db } from "@workspace/db";
import { usersTable, pipelinesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { safeUserFields } from "./safeUser";

export interface AssignmentResult {
  facilitatorId: string;
  facilitatorName: string;
  facilitatorEmail: string;
  activeCount: number;
}

export async function findLeastLoadedFacilitator(): Promise<AssignmentResult | null> {
  try {
    const facilitators = await db
      .select({
        ...safeUserFields,
        email: usersTable.email,
        activeCount: sql<number>`
          COALESCE((
            SELECT COUNT(*)::int
            FROM pipelines p
            WHERE p.assigned_facilitator_id = ${usersTable.id}
              AND p.status NOT IN ('COMPLETED', 'REJECTED')
          ), 0)
        `.as("active_count"),
      })
      .from(usersTable)
      .where(eq(usersTable.role, "FACILITATOR"))
      .orderBy(sql`active_count ASC`);

    if (facilitators.length === 0) {
      logger.warn("No facilitators available for auto-assignment");
      return null;
    }

    const chosen = facilitators[0];
    return {
      facilitatorId: chosen.id,
      facilitatorName: chosen.name,
      facilitatorEmail: chosen.email,
      activeCount: chosen.activeCount,
    };
  } catch (err) {
    logger.error({ err }, "Failed to find least-loaded facilitator");
    return null;
  }
}

export async function autoAssignPipeline(params: {
  pipelineId: string;
  companyName: string;
  companyId: string;
}): Promise<AssignmentResult | null> {
  const facilitator = await findLeastLoadedFacilitator();
  if (!facilitator) return null;

  try {
    await db
      .update(pipelinesTable)
      .set({
        assignedFacilitatorId: facilitator.facilitatorId,
        status: "ASSIGNED",
        updatedAt: new Date(),
      })
      .where(eq(pipelinesTable.id, params.pipelineId));

    logger.info(
      {
        pipelineId: params.pipelineId,
        facilitatorId: facilitator.facilitatorId,
        facilitatorName: facilitator.facilitatorName,
        activeCount: facilitator.activeCount,
      },
      "Pipeline auto-assigned to facilitator"
    );

    return facilitator;
  } catch (err) {
    logger.error({ err, ...params }, "Failed to auto-assign pipeline");
    return null;
  }
}
