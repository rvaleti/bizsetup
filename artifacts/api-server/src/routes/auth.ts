import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import passport from "../lib/auth";
import { requireAuth } from "../middlewares/requireAuth";

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
