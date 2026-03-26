import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  companiesTable,
  pipelinesTable,
  pipelineStepsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../middlewares/requireAuth";
import { DEFAULT_PIPELINE_STEPS } from "../lib/pipelineSteps";
import { User } from "@workspace/db/schema";

const router: IRouter = Router();

router.get("/companies", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { search, entityType, status, page = "1", pageSize = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (pageNum - 1) * pageSizeNum;

  try {
    const conditions = [];

    if (actor.role === "CUSTOMER") {
      conditions.push(eq(companiesTable.customerId, actor.id));
    } else if (actor.role === "FACILITATOR") {
      const assignedPipelineIds = db
        .select({ companyId: pipelinesTable.companyId })
        .from(pipelinesTable)
        .where(eq(pipelinesTable.assignedFacilitatorId, actor.id));
      conditions.push(
        or(
          eq(companiesTable.customerId, actor.id),
          sql`${companiesTable.id} IN (${assignedPipelineIds})`
        )
      );
    }

    if (search) {
      conditions.push(ilike(companiesTable.name, `%${search}%`));
    }

    if (entityType) {
      conditions.push(eq(companiesTable.entityType, entityType as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
            .where(sql`${pipelinesTable.companyId} = ANY(${sql.raw(`ARRAY[${companyIds.map(() => "?").join(",")}]`)})`
            )
        : [];

    const pipelineMap = new Map(pipelines.map((p) => [p.companyId, p]));

    const customerIds = [...new Set(companiesList.map((c) => c.customerId))];
    const customers =
      customerIds.length > 0
        ? await db.select().from(usersTable).where(
            sql`${usersTable.id} = ANY(ARRAY[${sql.raw(customerIds.map((id) => `'${id}'`).join(","))}]::text[])`
          )
        : [];
    const customerMap = new Map(customers.map((u) => [u.id, u]));

    const data = await Promise.all(
      companiesList.map(async (company) => {
        let pipeline = pipelineMap.get(company.id);
        if (!pipeline) {
          const [p] = await db
            .select()
            .from(pipelinesTable)
            .where(eq(pipelinesTable.companyId, company.id))
            .limit(1);
          pipeline = p;
        }

        let facilitator = null;
        if (pipeline?.assignedFacilitatorId) {
          const [f] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, pipeline.assignedFacilitatorId))
            .limit(1);
          facilitator = f ?? null;
        }

        return {
          ...company,
          pipeline: pipeline
            ? { ...pipeline, assignedFacilitator: facilitator }
            : null,
          customer: customerMap.get(company.customerId) ?? null,
        };
      })
    );

    if (status) {
      const filtered = data.filter((d) => d.pipeline?.status === status);
      res.json({
        data: filtered,
        total: filtered.length,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil(filtered.length / pageSizeNum),
      });
      return;
    }

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
        entityType: body.entityType as any,
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

    res.status(201).json({
      ...company,
      pipeline: { ...pipeline, assignedFacilitator: null },
      customer: actor,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create company");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to create company" });
  }
});

router.get("/companies/:companyId", requireAuth, async (req, res) => {
  const actor = req.user as User;
  const { companyId } = req.params;

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

    const [pipeline] = await db
      .select()
      .from(pipelinesTable)
      .where(eq(pipelinesTable.companyId, companyId))
      .limit(1);

    let facilitator = null;
    if (pipeline?.assignedFacilitatorId) {
      const [f] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, pipeline.assignedFacilitatorId))
        .limit(1);
      facilitator = f ?? null;
    }

    const [customer] = await db
      .select()
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
