declare global {
  namespace Express {
    interface User extends import("@workspace/db/schema").User {}
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    oauthState?: string;
  }
}

export {};
