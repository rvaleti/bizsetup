import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
      return;
    }
    const user = req.user as { role: string } | undefined;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "FORBIDDEN", message: "Insufficient permissions" });
      return;
    }
    next();
  };
}
