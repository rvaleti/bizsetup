import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { PipelineSchema, CompanySchema } from "./use-companies";
import { UserSchema } from "./use-auth";

export const PipelineStepSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  stepKey: z.string(),
  stepName: z.string(),
  description: z.string().nullable().optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED", "WAITING"]),
  assignedTo: z.enum(["CUSTOMER", "FACILITATOR"]).nullable().optional(),
  order: z.number().or(z.string()).transform(val => Number(val)),
  completedAt: z.string().nullable().optional(),
  completedBy: z.string().nullable().optional(),
});

export type PipelineStep = z.infer<typeof PipelineStepSchema>;

export const PipelineDetailSchema = PipelineSchema.extend({
  steps: z.array(PipelineStepSchema),
  company: CompanySchema,
  customer: UserSchema.nullable().optional(),
  assignedFacilitator: UserSchema.nullable().optional(),
});

export type PipelineDetail = z.infer<typeof PipelineDetailSchema>;

export function usePipeline(pipelineId: string) {
  return useQuery({
    queryKey: [`/api/pipelines/${pipelineId}`],
    queryFn: async () => {
      const res = await fetch(`/api/pipelines/${pipelineId}`);
      if (!res.ok) throw new Error("Failed to fetch pipeline details");
      return PipelineDetailSchema.parse(await res.json());
    },
    enabled: !!pipelineId,
  });
}

export function useUpdatePipelineStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, status, message, rejectionReason, rectificationNotes }: { pipelineId: string, status: string, message?: string, rejectionReason?: string, rectificationNotes?: string }) => {
      const res = await fetch(`/api/pipelines/${pipelineId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, message, rejectionReason, rectificationNotes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: (_, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipelines/${pipelineId}`] });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/companies") });
    }
  });
}

export function useUpdatePipelineStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, stepId, status }: { pipelineId: string, stepId: string, status: string }) => {
      const res = await fetch(`/api/pipelines/${pipelineId}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update step");
      }
      return res.json();
    },
    onSuccess: (_, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipelines/${pipelineId}`] });
    }
  });
}

export function useAssignFacilitator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, facilitatorId }: { pipelineId: string, facilitatorId: string }) => {
      const res = await fetch(`/api/pipelines/${pipelineId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilitatorId }),
      });
      if (!res.ok) throw new Error("Failed to assign facilitator");
      return res.json();
    },
    onSuccess: (_, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipelines/${pipelineId}`] });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/companies") });
    }
  });
}

export function useRequestMoreInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, details }: { pipelineId: string; details: string }) => {
      const res = await fetch(`/api/pipelines/${pipelineId}/more-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ details }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to request more info");
      }
      return res.json();
    },
    onSuccess: (_, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipelines/${pipelineId}`] });
    },
  });
}

export function useRectify() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, notes }: { pipelineId: string; notes: string }) => {
      const res = await fetch(`/api/pipelines/${pipelineId}/rectify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create rectification");
      }
      return res.json();
    },
    onSuccess: (_, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipelines/${pipelineId}`] });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/companies") });
    },
  });
}

export function useResubmit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId }: { pipelineId: string }) => {
      const res = await fetch(`/api/pipelines/${pipelineId}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to mark resubmission");
      }
      return res.json();
    },
    onSuccess: (_, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipelines/${pipelineId}`] });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/companies") });
    },
  });
}
