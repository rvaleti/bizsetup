import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["CUSTOMER", "FACILITATOR", "ADMIN"]),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string()
});
export type User = z.infer<typeof UserSchema>;

export function useAuth() {
  return useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return UserSchema.parse(await res.json());
    },
    retry: false,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", { method: "GET" });
      if (!res.ok) throw new Error("Failed to logout");
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    }
  });
}
