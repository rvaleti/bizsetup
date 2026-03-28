import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { companiesTable, pipelinesTable, usersTable } from "@workspace/db/schema";
import { eq, sql, gte, inArray, isNotNull } from "drizzle-orm";
import { requireRole } from "../middlewares/requireAuth";
import { safeUserFields } from "../lib/safeUser";

const router: IRouter = Router();

router.get("/admin/stats", requireRole("ADMIN"), async (req, res) => {
  try {
    const statusCounts = await db
      .select({
        status: pipelinesTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(pipelinesTable)
      .groupBy(pipelinesTable.status);

    const byStatus: Record<string, number> = {};
    for (const row of statusCounts) {
      byStatus[row.status] = row.count;
    }

    const entityCounts = await db
      .select({
        entityType: companiesTable.entityType,
        count: sql<number>`count(*)::int`,
      })
      .from(companiesTable)
      .groupBy(companiesTable.entityType);

    const byEntityType: Record<string, number> = {};
    for (const row of entityCounts) {
      byEntityType[row.entityType] = row.count;
    }

    const [{ totalCompanies }] = await db
      .select({ totalCompanies: sql<number>`count(*)::int` })
      .from(companiesTable);

    const [{ totalUsers }] = await db
      .select({ totalUsers: sql<number>`count(*)::int` })
      .from(usersTable);

    const [{ totalFacilitators }] = await db
      .select({ totalFacilitators: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.role, "FACILITATOR"));

    const [{ avgDays }] = await db
      .select({
        avgDays: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - ${pipelinesTable.createdAt})) / 86400), 0)::float`,
      })
      .from(pipelinesTable);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [{ companiesThisMonth }] = await db
      .select({ companiesThisMonth: sql<number>`count(*)::int` })
      .from(companiesTable)
      .where(gte(companiesTable.createdAt, startOfMonth));

    const facilitatorPipelineCounts = await db
      .select({
        facilitatorId: pipelinesTable.assignedFacilitatorId,
        count: sql<number>`count(*)::int`,
      })
      .from(pipelinesTable)
      .where(isNotNull(pipelinesTable.assignedFacilitatorId))
      .groupBy(pipelinesTable.assignedFacilitatorId);

    const facilitatorIds = facilitatorPipelineCounts
      .map((r) => r.facilitatorId)
      .filter((id): id is string => id !== null);

    const facilitators =
      facilitatorIds.length > 0
        ? await db.select(safeUserFields).from(usersTable).where(inArray(usersTable.id, facilitatorIds))
        : [];

    const facilitatorMap = new Map(facilitators.map((f) => [f.id, f]));

    const facilitatorWorkload = facilitatorPipelineCounts.map((row) => ({
      facilitator: row.facilitatorId ? (facilitatorMap.get(row.facilitatorId) ?? null) : null,
      assignedCount: row.count,
    }));

    res.json({
      totalCompanies,
      byStatus,
      byEntityType,
      totalUsers,
      totalFacilitators,
      avgPipelineAgeDays: Math.round(avgDays * 10) / 10,
      companiesThisMonth,
      facilitatorWorkload,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin stats");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to get admin stats" });
  }
});

export default router;
