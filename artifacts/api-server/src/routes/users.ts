import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, userRoleEnum } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "../middlewares/requireAuth";

const router: IRouter = Router();

type UserRole = typeof userRoleEnum.enumValues[number];
const VALID_ROLES = new Set<string>(userRoleEnum.enumValues);

router.get("/users", requireRole("ADMIN"), async (req, res) => {
  const { role } = req.query as { role?: string };

  try {
    const users = role && VALID_ROLES.has(role)
      ? await db.select().from(usersTable).where(eq(usersTable.role, role as UserRole)).orderBy(usersTable.name)
      : await db.select().from(usersTable).orderBy(usersTable.name);

    res.json(users);
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to list users" });
  }
});

router.patch("/users/:userId/role", requireRole("ADMIN"), async (req, res) => {
  const { userId } = req.params as Record<string, string>;
  const { role } = req.body as { role: string };

  if (!role || !VALID_ROLES.has(role)) {
    res.status(422).json({ error: "VALIDATION_ERROR", message: "Valid role is required" });
    return;
  }

  const newRole = role as UserRole;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update user role");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to update user role" });
  }
});

export default router;
