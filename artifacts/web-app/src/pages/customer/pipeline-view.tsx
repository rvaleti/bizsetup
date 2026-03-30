import { usePipeline } from "@/hooks/use-pipelines";
import { useRoute, Link } from "wouter";
import { StatusBadge } from "@/components/status-badge";
import { Chatter } from "@/components/chatter";
import {
  Building2,
  Phone,
  Mail,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO, format } from "date-fns";
import { useEffect, useState } from "react";

function PipelineVisualizer({ steps }: { steps: any[] }) {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const completedCount = sorted.filter((s) => s.status === "COMPLETED").length;

  const getStepColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-100 border-emerald-300 text-emerald-700";
      case "IN_PROGRESS":
        return "bg-blue-100 border-blue-300 text-blue-700";
      case "WAITING":
        return "bg-purple-100 border-purple-300 text-purple-700";
      case "PENDING":
        return "bg-slate-100 border-slate-300 text-slate-600";
      case "SKIPPED":
        return "bg-slate-50 border-slate-200 text-slate-400";
      default:
        return "bg-gray-100 border-gray-300 text-gray-700";
    }
  };

  const getLineColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-300";
      case "IN_PROGRESS":
        return "bg-blue-300";
      case "WAITING":
        return "bg-purple-300";
      default:
        return "bg-slate-200";
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold font-display text-slate-900 mb-1">Registration Pipeline</h2>
        <p className="text-sm text-slate-500">
          {completedCount} of {sorted.length} steps completed ({Math.round((completedCount / sorted.length) * 100)}%)
        </p>
      </div>

      <div className="space-y-4">
        {sorted.map((step, idx) => (
          <div key={step.id}>
            {/* Step card */}
            <div className={`p-4 rounded-lg border-2 ${getStepColor(step.status)} transition-all`}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-current flex items-center justify-center font-bold text-sm">
                  {step.status === "COMPLETED" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className={`font-semibold text-sm ${
                      step.status === "COMPLETED" ? "line-through text-slate-400" : ""
                    }`}
                  >
                    {step.stepName}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{step.description}</p>
                  {step.status === "WAITING" && (
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-purple-50 rounded text-xs text-purple-700">
                      <Clock className="w-3 h-3" /> Awaiting government response
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <Badge
                    variant={step.status === "COMPLETED" ? "secondary" : "outline"}
                    className={`text-xs font-medium ${
                      step.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : step.status === "IN_PROGRESS"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : step.status === "WAITING"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : ""
                    }`}
                  >
                    {step.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Connector line to next step */}
            {idx < sorted.length - 1 && (
              <div className="flex justify-center py-1">
                <div className={`w-1 h-6 rounded-full ${getLineColor(step.status)}`} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-emerald-600">{completedCount}</div>
            <p className="text-xs text-slate-500 mt-1">Completed</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {sorted.filter((s) => s.status === "IN_PROGRESS").length}
            </div>
            <p className="text-xs text-slate-500 mt-1">In Progress</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-400">
              {sorted.filter((s) => s.status === "PENDING" || s.status === "WAITING").length}
            </div>
            <p className="text-xs text-slate-500 mt-1">Pending / Waiting</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerPipelineView() {
  const [, params] = useRoute("/pipeline/:id");
  const pipelineId = params?.id || "";

  const { data: pipeline, isLoading, error } = usePipeline(pipelineId);
  const [mermaidLoaded, setMermaidLoaded] = useState(false);

  useEffect(() => {
    // Try to load mermaid if it's available
    if (window.mermaid) {
      setMermaidLoaded(true);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-[600px] rounded-2xl" />
          <Skeleton className="h-[600px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !pipeline) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">Pipeline not found</h3>
        <p className="text-slate-500 mt-2">Unable to load this pipeline.</p>
      </div>
    );
  }

  const createdAt = parseISO(pipeline.createdAt);
  const daysElapsed = differenceInDays(new Date(), createdAt);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Back link */}
      <Link href="/dashboard">
        <button className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </Link>

      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 truncate">
                {pipeline.company.name}
              </h1>
              <StatusBadge status={pipeline.status} className="text-sm px-3 py-1" />
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                {pipeline.company.city}, {pipeline.company.state}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                {pipeline.company.primaryPhone}
              </div>
              {pipeline.company.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {pipeline.company.email}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                {daysElapsed}d elapsed · Started {format(createdAt, "dd MMM yyyy")}
              </div>
            </div>
          </div>

          {pipeline.assignedFacilitator && (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 min-w-[280px]">
              <p className="text-xs text-blue-700 font-semibold uppercase tracking-wider mb-1">Assigned Facilitator</p>
              <p className="font-semibold text-blue-900">{pipeline.assignedFacilitator.name}</p>
              <p className="text-xs text-blue-600 mt-1">{pipeline.assignedFacilitator.email}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Visualizer */}
        <div className="lg:col-span-2">
          {pipeline.steps && pipeline.steps.length > 0 ? (
            <PipelineVisualizer steps={pipeline.steps} />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
              No steps available
            </div>
          )}
        </div>

        {/* Chatter */}
        <div className="h-[700px]">
          <Chatter pipelineId={pipelineId} />
        </div>
      </div>
    </div>
  );
}
