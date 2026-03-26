import { User } from "@workspace/db/schema";

declare global {
  namespace Express {
    interface User extends Omit<import("@workspace/db/schema").User, never> {}
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}
