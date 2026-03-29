import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { buildLoginUrl, handleCallback, upsertUser, randomPKCECodeVerifier, randomState, randomNonce } from "../lib/auth";

const router: IRouter = Router();

const FRONTEND_URL = process.env.FRONTEND_URL ?? "/";

router.get("/login", async (req, res) => {
  try {
    const codeVerifier = randomPKCECodeVerifier();
    const state = randomState();
    const nonce = randomNonce();

    req.session.oidcCodeVerifier = codeVerifier;
    req.session.oidcState = state;
    req.session.oidcNonce = nonce;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const authUrl = await buildLoginUrl(codeVerifier, state, nonce);
    res.redirect(authUrl.href);
  } catch (err) {
    req.log.error({ err }, "Failed to initiate OIDC login");
    res.redirect(`${FRONTEND_URL}?auth_error=1`);
  }
});

router.get("/callback", async (req, res) => {
  try {
    const codeVerifier = req.session.oidcCodeVerifier as string | undefined;
    const expectedState = req.session.oidcState as string | undefined;
    const expectedNonce = req.session.oidcNonce as string | undefined;

    if (!codeVerifier || !expectedState || !expectedNonce) {
      req.log.warn("OIDC callback: missing session PKCE/state/nonce");
      res.redirect(`${FRONTEND_URL}?auth_error=1`);
      return;
    }

    delete req.session.oidcCodeVerifier;
    delete req.session.oidcState;
    delete req.session.oidcNonce;

    const protocol = req.headers["x-forwarded-proto"] ?? req.protocol;
    const host = req.headers["x-forwarded-host"] ?? req.headers.host;
    const currentUrl = new URL(`${protocol}://${host}${req.originalUrl}`);
    
    req.log.info({ originalUrl: req.originalUrl, protocol, host, fullUrl: currentUrl.href }, "OIDC callback URL constructed");

    const tokens = await handleCallback(currentUrl, codeVerifier, expectedState, expectedNonce);
    const claims = tokens.claims();

    if (!claims) {
      req.log.error("OIDC callback: no ID token claims");
      res.redirect(`${FRONTEND_URL}?auth_error=1`);
      return;
    }

    const user = await upsertUser({
      sub: claims.sub,
      email: claims.email as string | undefined,
      name: claims.name as string | undefined,
      given_name: claims.given_name as string | undefined,
      picture: claims.picture as string | undefined,
    });

    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    req.log.info({ userId: user.id, sid: req.sessionID }, "OIDC login success, session saved");
    res.redirect(FRONTEND_URL);
  } catch (err) {
    req.log.error({ err }, "OIDC callback error");
    res.redirect(`${FRONTEND_URL}?auth_error=1`);
  }
});

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

router.get("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Error destroying session on logout");
      res.status(500).json({ error: "LOGOUT_ERROR", message: "Failed to log out" });
      return;
    }
    res.clearCookie("connect.sid");
    res.redirect(FRONTEND_URL);
  });
});

export default router;
