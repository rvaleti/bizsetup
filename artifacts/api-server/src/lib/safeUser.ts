import { usersTable } from "@workspace/db/schema";

export const safeUserFields = {
  id: usersTable.id,
  email: usersTable.email,
  name: usersTable.name,
  avatarUrl: usersTable.avatarUrl,
  role: usersTable.role,
  createdAt: usersTable.createdAt,
};

export type SafeUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: "CUSTOMER" | "FACILITATOR" | "ADMIN";
  createdAt: Date;
};
