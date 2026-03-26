import { Router, type IRouter } from "express";
import passport from "../lib/auth";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const FRONTEND_URL = process.env.FRONTEND_URL ?? "/";

router.get("/auth/google", (req, res, next) => {
  const state = Buffer.from(Math.random().toString(36)).toString("base64");
  req.session.oauthState = state;
  req.session.save(() => {
    passport.authenticate("google", {
      scope: ["profile", "email"],
      state,
    })(req, res, next);
  });
});

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${FRONTEND_URL}?auth_error=1`,
    session: false,
  }),
  (req, res) => {
    if (!req.user) {
      res.redirect(`${FRONTEND_URL}?auth_error=1`);
      return;
    }
    const user = req.user as { id: string };
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        req.log.error({ err }, "Failed to save session after OAuth callback");
        res.redirect(`${FRONTEND_URL}?auth_error=1`);
        return;
      }
      res.redirect(FRONTEND_URL);
    });
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
