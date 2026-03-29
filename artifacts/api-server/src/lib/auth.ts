import { discovery, buildAuthorizationUrl, authorizationCodeGrant, randomPKCECodeVerifier, calculatePKCECodeChallenge, randomState, randomNonce } from "openid-client";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "./logger";

if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID environment variable is required");
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("GOOGLE_CLIENT_SECRET environment variable is required");
}

const GOOGLE_ISSUER = new URL("https://accounts.google.com");

let _config: Awaited<ReturnType<typeof discovery>> | null = null;

export async function getOidcConfig() {
  if (!_config) {
    _config = await discovery(GOOGLE_ISSUER, process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!);
  }
  return _config;
}

export function getCallbackURL(): string {
  if (process.env.CALLBACK_BASE_URL) {
    return `${process.env.CALLBACK_BASE_URL}/api/callback`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/callback`;
  }
  throw new Error("Either CALLBACK_BASE_URL or REPLIT_DEV_DOMAIN must be set");
}

export async function buildLoginUrl(codeVerifier: string, state: string, nonce: string): Promise<URL> {
  const config = await getOidcConfig();
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
  return buildAuthorizationUrl(config, {
    redirect_uri: getCallbackURL(),
    scope: "openid profile email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });
}

export async function handleCallback(currentUrl: URL, codeVerifier: string, expectedState: string, expectedNonce: string) {
  const config = await getOidcConfig();
  const tokens = await authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedState,
    expectedNonce,
  });
  return tokens;
}

export async function upsertUser(claims: {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  picture?: string;
}) {
  const email = claims.email;
  if (!email) {
    throw new Error("No email returned from Google");
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.oauthProvider, "google"),
        eq(usersTable.oauthId, claims.sub)
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(usersTable)
    .values({
      id: randomUUID(),
      oauthProvider: "google",
      oauthId: claims.sub,
      email,
      name: claims.name ?? claims.given_name ?? email,
      avatarUrl: claims.picture ?? null,
      role: "CUSTOMER",
    })
    .returning();

  logger.info({ userId: created.id, email }, "New user created via Google OIDC");
  return created;
}

export { randomPKCECodeVerifier, randomState, randomNonce };
