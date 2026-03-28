import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { UserSchema } from "./use-auth";

export function useUsers(role?: string, enabled = true) {
  const queryStr = role ? `?role=${role}` : "";
  return useQuery({
    queryKey: [`/api/users${queryStr}`],
    queryFn: async () => {
      const res = await fetch(`/api/users${queryStr}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return z.array(UserSchema).parse(await res.json());
    },
    enabled,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed to update user role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    }
  });
}
