import type { User } from "@workspace/db/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    oidcCodeVerifier?: string;
    oidcState?: string;
    oidcNonce?: string;
  }
}

export {};
