import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    return;
  }
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "UNAUTHORIZED", message: "User not found" });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    req.log.error({ err }, "requireAuth DB lookup failed");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Internal server error" });
  }
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.session?.userId;
    if (!userId) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
      return;
    }
    try {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (!user) {
        req.session.destroy(() => {});
        res.status(401).json({ error: "UNAUTHORIZED", message: "User not found" });
        return;
      }

      if (!roles.includes(user.role)) {
        res.status(403).json({ error: "FORBIDDEN", message: "Insufficient permissions" });
        return;
      }

      req.user = user;
      next();
    } catch (err) {
      req.log.error({ err }, "requireRole DB lookup failed");
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Internal server error" });
    }
  };
}
