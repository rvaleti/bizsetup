import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";

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

const NOTIFICATION_TYPE_TITLES: Record<string, string> = {
  STATUS_CHANGE: "Status Updated",
  ASSIGNED: "Pipeline Assigned",
  COMMENT: "New Comment",
  STEP_COMPLETE: "Step Completed",
  REJECTED: "Pipeline Rejected",
  RECTIFICATION: "Rectification Required",
  SYSTEM: "System Update",
};

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
  const retryDelayRef = useRef(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;

      const es = new EventSource("/api/notifications/stream", { withCredentials: true });
      esRef.current = es;

      es.addEventListener("connected", () => {
        retryDelayRef.current = 1000;
      });

      es.addEventListener("notification", (e) => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/notifications?unreadOnly=true"] });

        try {
          const parsed = NotificationSchema.parse(JSON.parse(e.data));
          const title = NOTIFICATION_TYPE_TITLES[parsed.type] ?? "Notification";
          toast({
            title,
            description: parsed.message,
            duration: 5000,
          });
        } catch {
          toast({
            title: "New Notification",
            description: "You have a new update.",
            duration: 5000,
          });
        }
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;

        if (!cancelled) {
          const delay = Math.min(retryDelayRef.current, 30000);
          retryDelayRef.current = Math.min(delay * 2, 30000);
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [queryClient]);
}
