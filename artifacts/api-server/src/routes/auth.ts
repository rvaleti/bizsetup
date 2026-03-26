import { Router, type IRouter } from "express";
import passport from "../lib/auth";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/?auth_error=1",
    session: true,
  }),
  (_req, res) => {
    res.redirect("/");
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

router.post("/auth/logout", requireAuth, (req, res) => {
  req.logout((err) => {
    if (err) {
      req.log.error({ err }, "Error during logout");
      res.status(500).json({ error: "LOGOUT_ERROR", message: "Failed to log out" });
      return;
    }
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });
});

export default router;
