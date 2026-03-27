import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  pipelineId: z.string().nullable().optional(),
  type: z.string(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
});

export type Notification = z.infer<typeof NotificationSchema>;

export function useNotifications(unreadOnly = false) {
  const queryStr = unreadOnly ? "?unreadOnly=true" : "";
  return useQuery({
    queryKey: [`/api/notifications${queryStr}`],
    queryFn: async () => {
      const res = await fetch(`/api/notifications${queryStr}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      return {
        data: z.array(NotificationSchema).parse(data.data || []),
        unreadCount: Number(data.unreadCount || 0)
      };
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications?unreadOnly=true"] });
    }
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/notifications/read-all`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark all read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications?unreadOnly=true"] });
    }
  });
}

export function useNotificationsSSE() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const es = new EventSource("/api/notifications/sse", { withCredentials: true });
    
    es.addEventListener("notification", () => {
      // Invalidate to refresh the bell and list
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications?unreadOnly=true"] });
    });
    
    return () => {
      es.close();
    };
  }, [queryClient]);
}
