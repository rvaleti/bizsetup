import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  companiesTable,
  pipelinesTable,
  pipelineStepsTable,
  usersTable,
  entityTypeEnum,
  pipelineStatusEnum,
  User,
} from "@workspace/db/schema";
import { eq, and, ilike, sql, inArray, SQL } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../middlewares/requireAuth";
import { DEFAULT_PIPELINE_STEPS } from "../lib/pipelineSteps";
import { safeUserFields, SafeUser } from "../lib/safeUser";

const router: IRouter = Router();

type EntityType = typeof entityTypeEnum.enumValues[number];
const VALID_ENTITY_TYPES = new Set<string>(entityTypeEnum.enumValues);

type PipelineStatus = typeof pipelineStatusEnum.enumValues[number];
const VALID_PIPELINE_STATUSES = new Set<string>(pipelineStatusEnum.enumValues);

router.get("/companies", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { search, entityType, status, page = "1", pageSize = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (pageNum - 1) * pageSizeNum;

  try {
    const companyConditions: SQL[] = [];

    if (actor.role === "CUSTOMER") {
      companyConditions.push(eq(companiesTable.customerId, actor.id));
    } else if (actor.role === "FACILITATOR") {
      const assignedCompanyIds = await db
        .select({ companyId: pipelinesTable.companyId })
        .from(pipelinesTable)
        .where(eq(pipelinesTable.assignedFacilitatorId, actor.id));
      const ids = assignedCompanyIds.map((r) => r.companyId);
      if (ids.length === 0) {
        res.json({ data: [], total: 0, page: pageNum, pageSize: pageSizeNum, totalPages: 0 });
        return;
      }
      companyConditions.push(inArray(companiesTable.id, ids));
    }
    // ADMIN sees all companies

    if (search) {
      companyConditions.push(ilike(companiesTable.name, `%${search}%`));
    }

    if (entityType && VALID_ENTITY_TYPES.has(entityType)) {
      companyConditions.push(eq(companiesTable.entityType, entityType as EntityType));
    }

    if (status) {
      if (!VALID_PIPELINE_STATUSES.has(status)) {
        res.status(422).json({ error: "VALIDATION_ERROR", message: `Invalid status: ${status}` });
        return;
      }
      const matchingIds = await db
        .select({ companyId: pipelinesTable.companyId })
        .from(pipelinesTable)
        .where(eq(pipelinesTable.status, status as PipelineStatus));
      const ids = matchingIds.map((r) => r.companyId);
      if (ids.length === 0) {
        res.json({ data: [], total: 0, page: pageNum, pageSize: pageSizeNum, totalPages: 0 });
        return;
      }
      companyConditions.push(inArray(companiesTable.id, ids));
    }

    const whereClause = companyConditions.length > 0 ? and(...companyConditions) : undefined;

    const companiesList = await db
      .select()
      .from(companiesTable)
      .where(whereClause)
      .limit(pageSizeNum)
      .offset(offset)
      .orderBy(companiesTable.createdAt);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(companiesTable)
      .where(whereClause);

    const companyIds = companiesList.map((c) => c.id);

    const pipelines =
      companyIds.length > 0
        ? await db
            .select()
            .from(pipelinesTable)
            .where(inArray(pipelinesTable.companyId, companyIds))
        : [];

    const pipelineMap = new Map(pipelines.map((p) => [p.companyId, p]));

    const customerIds = [...new Set(companiesList.map((c) => c.customerId))];
    const customers =
      customerIds.length > 0
        ? await db.select(safeUserFields).from(usersTable).where(inArray(usersTable.id, customerIds))
        : [] as SafeUser[];
    const customerMap = new Map(customers.map((u) => [u.id, u]));

    const facilitatorIds = [
      ...new Set(
        pipelines
          .map((p) => p.assignedFacilitatorId)
          .filter((id): id is string => id !== null)
      ),
    ];
    const facilitators =
      facilitatorIds.length > 0
        ? await db.select(safeUserFields).from(usersTable).where(inArray(usersTable.id, facilitatorIds))
        : [] as SafeUser[];
    const facilitatorMap = new Map(facilitators.map((f) => [f.id, f]));

    const data = companiesList.map((company) => {
      const pipeline = pipelineMap.get(company.id);
      const facilitator = pipeline?.assignedFacilitatorId
        ? (facilitatorMap.get(pipeline.assignedFacilitatorId) ?? null)
        : null;
      return {
        ...company,
        pipeline: pipeline
          ? { ...pipeline, assignedFacilitator: facilitator }
          : null,
        customer: customerMap.get(company.customerId) ?? null,
      };
    });

    res.json({
      data,
      total: count,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(count / pageSizeNum),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list companies");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to list companies" });
  }
});

router.post("/companies", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const body = req.body as {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    entityType: string;
    primaryPhone: string;
    alternatePhone?: string;
    email?: string;
    description?: string;
  };

  if (!body.name || !body.address || !body.city || !body.state || !body.pincode || !body.entityType || !body.primaryPhone) {
    res.status(422).json({ error: "VALIDATION_ERROR", message: "Missing required fields" });
    return;
  }

  if (!VALID_ENTITY_TYPES.has(body.entityType)) {
    res.status(422).json({ error: "VALIDATION_ERROR", message: `Invalid entityType: ${body.entityType}` });
    return;
  }

  const entityType = body.entityType as EntityType;

  try {
    const companyId = randomUUID();
    const pipelineId = randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(companiesTable).values({
        id: companyId,
        customerId: actor.id,
        name: body.name,
        address: body.address,
        city: body.city,
        state: body.state,
        pincode: body.pincode,
        entityType,
        primaryPhone: body.primaryPhone,
        alternatePhone: body.alternatePhone ?? null,
        email: body.email ?? null,
        description: body.description ?? null,
      });

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

    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);

    const [pipeline] = await db
      .select()
      .from(pipelinesTable)
      .where(eq(pipelinesTable.id, pipelineId))
      .limit(1);

    const safeActor: SafeUser = {
      id: actor.id,
      email: actor.email,
      name: actor.name,
      avatarUrl: actor.avatarUrl ?? null,
      role: actor.role,
      createdAt: actor.createdAt,
    };

    res.status(201).json({
      ...company,
      pipeline: { ...pipeline, assignedFacilitator: null },
      customer: safeActor,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create company");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to create company" });
  }
});

router.get("/companies/:companyId", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { companyId } = req.params as Record<string, string>;

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

    // Customers can only see their own companies; FACILITATOR and ADMIN can see all (per API contract)
    if (actor.role === "CUSTOMER" && company.customerId !== actor.id) {
      res.status(403).json({ error: "FORBIDDEN", message: "Access denied" });
      return;
    }

    const [pipeline] = await db
      .select()
      .from(pipelinesTable)
      .where(eq(pipelinesTable.companyId, companyId))
      .limit(1);

    let facilitator: SafeUser | null = null;
    if (pipeline?.assignedFacilitatorId) {
      const [f] = await db
        .select(safeUserFields)
        .from(usersTable)
        .where(eq(usersTable.id, pipeline.assignedFacilitatorId))
        .limit(1);
      facilitator = f ?? null;
    }

    const [customer] = await db
      .select(safeUserFields)
      .from(usersTable)
      .where(eq(usersTable.id, company.customerId))
      .limit(1);

    res.json({
      ...company,
      pipeline: pipeline ? { ...pipeline, assignedFacilitator: facilitator } : null,
      customer: customer ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get company");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to get company" });
  }
});

export default router;
