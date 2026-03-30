import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: string;
  className?: string;
};

const statusConfig: Record<string, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300" },
  ASSIGNED: { label: "Assigned", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300" },
  IN_PROGRESS: { label: "In Progress", className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300" },
  WAITING: { label: "Waiting on Gov", className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300" },
  RECTIFICATION: { label: "Action Required", className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300" },
  RE_SUBMITTED: { label: "Re-Submitted", className: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300" },

  // Step Statuses
  PENDING: { label: "Pending", className: "bg-slate-100 text-slate-600 border-slate-200" },
  SKIPPED: { label: "Skipped", className: "bg-slate-100 text-slate-500 border-dashed border-slate-300" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-800" };
  
  return (
    <Badge variant="outline" className={cn("font-medium", config.className, className)}>
      {config.label}
    </Badge>
  );
}
