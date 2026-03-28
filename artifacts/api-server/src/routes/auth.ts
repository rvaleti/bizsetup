import { Router, type IRouter } from "express";
import { randomBytes, randomUUID } from "crypto";
import passport from "../lib/auth";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const FRONTEND_URL = process.env.FRONTEND_URL ?? "/";

router.get("/auth/google", (req, res, next) => {
  const state = randomBytes(16).toString("hex");
  req.session.oauthState = state;
  req.session.save((err) => {
    if (err) {
      req.log.error({ err }, "Failed to save OAuth state to session");
      res.redirect(`${FRONTEND_URL}?auth_error=1`);
      return;
    }
    passport.authenticate("google", {
      scope: ["profile", "email"],
      state,
    })(req, res, next);
  });
});

router.get(
  "/auth/google/callback",
  (req, res, next) => {
    const stateParam = req.query.state as string | undefined;
    const savedState = req.session.oauthState as string | undefined;

    if (!stateParam || !savedState || stateParam !== savedState) {
      req.log.warn({ stateParam, hasSaved: !!savedState }, "OAuth CSRF state mismatch");
      res.redirect(`${FRONTEND_URL}?auth_error=1`);
      return;
    }

    delete req.session.oauthState;

    passport.authenticate(
      "google",
      { session: false },
      (err: Error | null, user: { id: string } | false) => {
        if (err) {
          req.log.error({ err }, "OAuth callback passport error");
          res.redirect(`${FRONTEND_URL}?auth_error=1`);
          return;
        }
        if (!user) {
          req.log.warn("OAuth callback: no user returned");
          res.redirect(`${FRONTEND_URL}?auth_error=1`);
          return;
        }
        req.session.userId = user.id;
        req.session.save((saveErr) => {
          if (saveErr) {
            req.log.error({ err: saveErr }, "Failed to save session after OAuth callback");
            res.redirect(`${FRONTEND_URL}?auth_error=1`);
            return;
          }
          req.log.info({ userId: user.id, sid: req.sessionID }, "OAuth login success, session saved");
          res.redirect(FRONTEND_URL);
        });
      }
    )(req, res, next);
  }
);

router.get("/auth/me", requireAuth, (req, res) => {
  const user = req.user as {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    role: string;
    createdAt: Date;
  };
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    createdAt: user.createdAt,
  });
});

router.post("/auth/google/token", async (req, res) => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Token is required" });
    return;
  }

  try {
    // Verify token with Google's tokeninfo endpoint
    const response = await fetch("https://www.googleapis.com/oauth2/v1/tokeninfo", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `id_token=${token}`,
    });

    if (!response.ok) {
      req.log.warn("Invalid token received");
      res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token" });
      return;
    }

    const tokenData = (await response.json()) as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
    };

    // Find or create user
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.oauthId, tokenData.sub))
      .limit(1);

    if (!user) {
      // Create new user
      const newUsers = await db
        .insert(usersTable)
        .values({
          id: randomUUID(),
          email: tokenData.email,
          name: tokenData.name || tokenData.email.split("@")[0],
          avatarUrl: tokenData.picture || null,
          role: "CUSTOMER",
          oauthProvider: "google",
          oauthId: tokenData.sub,
        })
        .returning();
      
      const newUser = newUsers[0];

      if (!newUser) {
        throw new Error("Failed to create user");
      }

      // Set session and redirect
      req.session.userId = newUser.id;
      req.session.save((err) => {
        if (err) {
          req.log.error({ err }, "Failed to save session");
          res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to create session" });
          return;
        }
        req.log.info({ userId: newUser.id }, "New user created via Google Sign-In");
        res.json({ success: true });
      });
    } else {
      // Existing user
      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) {
          req.log.error({ err }, "Failed to save session");
          res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to create session" });
          return;
        }
        req.log.info({ userId: user.id }, "User authenticated via Google Sign-In");
        res.json({ success: true });
      });
    }
  } catch (err) {
    req.log.error({ err }, "Google Sign-In token verification failed");
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to verify token" });
  }
});

router.get("/auth/logout", requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Error destroying session on logout");
      res.status(500).json({ error: "LOGOUT_ERROR", message: "Failed to log out" });
      return;
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully" });
  });
});

export default router;
