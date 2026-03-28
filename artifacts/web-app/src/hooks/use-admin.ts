import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { UserSchema } from "./use-auth";

const AdminStatsSchema = z.object({
  totalCompanies: z.number(),
  byStatus: z.record(z.number()),
  byEntityType: z.record(z.number()),
  totalUsers: z.number(),
  totalFacilitators: z.number(),
  avgPipelineAgeDays: z.number(),
  companiesThisMonth: z.number(),
  facilitatorWorkload: z.array(z.object({
    facilitator: UserSchema.nullable().optional(),
    assignedCount: z.number(),
  })),
  ageDistribution: z.array(z.object({
    range: z.string(),
    count: z.number(),
  })).optional(),
});

export type AdminStats = z.infer<typeof AdminStatsSchema>;

export function useAdminStats() {
  return useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch admin stats");
      return AdminStatsSchema.parse(await res.json());
    }
  });
}
