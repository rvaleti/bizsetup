import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
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

const callbackURL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`
  : `${process.env.CALLBACK_BASE_URL ?? ""}/api/auth/google/callback`;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL,
      scope: ["profile", "email"],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error("No email returned from Google"), undefined);
        }

        const [existing] = await db
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.oauthProvider, "google"),
              eq(usersTable.oauthId, profile.id)
            )
          )
          .limit(1);

        if (existing) {
          return done(null, existing);
        }

        const [created] = await db
          .insert(usersTable)
          .values({
            id: randomUUID(),
            oauthProvider: "google",
            oauthId: profile.id,
            email,
            name: profile.displayName ?? email,
            avatarUrl: profile.photos?.[0]?.value ?? null,
            role: "CUSTOMER",
          })
          .returning();

        logger.info({ userId: created.id, email }, "New user created via Google OAuth");
        return done(null, created);
      } catch (err) {
        logger.error({ err }, "Error in Google OAuth strategy");
        return done(err as Error, undefined);
      }
    }
  )
);

passport.serializeUser((user: Express.User, done) => {
  done(null, (user as { id: string }).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    done(null, user ?? null);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
