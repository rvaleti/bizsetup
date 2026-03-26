import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const email = process.argv[2];

if (!email) {
  console.error("Usage: pnpm --filter @workspace/scripts run seed-admin <email>");
  process.exit(1);
}

const [user] = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, email))
  .limit(1);

if (!user) {
  console.error(`No user found with email: ${email}`);
  console.error("The user must log in at least once before being promoted.");
  process.exit(1);
}

const [updated] = await db
  .update(usersTable)
  .set({ role: "ADMIN", updatedAt: new Date() })
  .where(eq(usersTable.email, email))
  .returning();

console.log(`Successfully promoted ${updated.name} (${updated.email}) to ADMIN role.`);
process.exit(0);
