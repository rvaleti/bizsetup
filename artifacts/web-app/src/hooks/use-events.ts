import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { UserSchema } from "./use-auth";

export const PipelineEventSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  actorId: z.string().nullable().optional(),
  actor: UserSchema.nullable().optional(),
  eventType: z.string(),
  previousStatus: z.string().nullable().optional(),
  newStatus: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type PipelineEvent = z.infer<typeof PipelineEventSchema>;

export function usePipelineEvents(pipelineId: string) {
  return useQuery({
    queryKey: [`/api/pipelines/${pipelineId}/events`],
    queryFn: async () => {
      const res = await fetch(`/api/pipelines/${pipelineId}/events`);
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      return z.array(PipelineEventSchema).parse(data.data || []);
    },
    enabled: !!pipelineId,
  });
}

export function usePostComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, message }: { pipelineId: string, message: string }) => {
      const res = await fetch(`/api/pipelines/${pipelineId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      return res.json();
    },
    onSuccess: (_, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipelines/${pipelineId}/events`] });
    }
  });
}
