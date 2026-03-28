import { usePipeline, useUpdatePipelineStatus, useUpdatePipelineStep } from "@/hooks/use-pipelines";
import { useRoute, Link } from "wouter";
import { StatusBadge } from "@/components/status-badge";
import { Chatter } from "@/components/chatter";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Phone,
  Mail,
  Check,
  Play,
  ChevronLeft,
  Clock,
  RotateCcw,
  AlertCircle,
  Hourglass,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { differenceInDays, parseISO, format } from "date-fns";
import { Badge } from "@/components/ui/badge";

type TransitionAction = {
  status: string;
  label: string;
  description: string;
  variant: "default" | "destructive" | "outline" | "secondary";
  noteLabel?: string;
  noteRequired?: boolean;
  icon?: React.ReactNode;
};

const FACILITATOR_TRANSITIONS: Record<string, TransitionAction[]> = {
  ASSIGNED: [
    {
      status: "IN_PROGRESS",
      label: "Start Working",
      description: "Mark this pipeline as actively in progress.",
      variant: "default",
      icon: <Play className="w-4 h-4" />,
    },
  ],
  IN_PROGRESS: [
    {
      status: "WAITING",
      label: "Mark Waiting on Gov",
      description: "Waiting for a government authority to process or respond.",
      variant: "outline",
      noteLabel: "What are you waiting for?",
      noteRequired: true,
      icon: <Hourglass className="w-4 h-4" />,
    },
    {
      status: "COMPLETED",
      label: "Mark Completed",
      description: "All steps are done and the registration is complete.",
      variant: "default",
      noteLabel: "Any completion notes?",
      icon: <Check className="w-4 h-4" />,
    },
  ],
  WAITING: [
    {
      status: "IN_PROGRESS",
      label: "Resume Progress",
      description: "Government processing complete — resume work.",
      variant: "default",
      icon: <Play className="w-4 h-4" />,
    },
  ],
  RECTIFICATION: [
    {
      status: "IN_PROGRESS",
      label: "Begin Rectification",
      description: "Start addressing the rectification items.",
      variant: "default",
      noteLabel: "What steps are you taking?",
      noteRequired: true,
      icon: <RotateCcw className="w-4 h-4" />,
    },
  ],
  NEW: [],
  COMPLETED: [],
  REJECTED: [],
};

function entityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    PRIVATE_LIMITED: "Private Limited",
    PUBLIC_LIMITED: "Public Limited",
    LLP: "LLP",
    OPC: "One Person Company",
    PARTNERSHIP: "Partnership Firm",
    SOLE_PROPRIETORSHIP: "Sole Proprietorship",
    SECTION_8: "Section 8 Company",
  };
  return labels[type] ?? type;
}

export default function FacilitatorPipelineDetail() {
  const [, params] = useRoute("/facilitator/pipeline/:id");
  const pipelineId = params?.id || "";

  const { data: pipeline, isLoading } = usePipeline(pipelineId);
  const updateStatus = useUpdatePipelineStatus();
  const updateStep = useUpdatePipelineStep();
  const { toast } = useToast();

  const [pendingAction, setPendingAction] = useState<TransitionAction | null>(null);
  const [actionNote, setActionNote] = useState("");

  const handleStatusTransition = async () => {
    if (!pendingAction) return;
    try {
      await updateStatus.mutateAsync({
        pipelineId,
        status: pendingAction.status,
        message: actionNote || undefined,
        rectificationNotes: pendingAction.status === "RECTIFICATION" ? actionNote : undefined,
      });
      toast({ title: "Pipeline status updated", description: `Moved to ${pendingAction.label}` });
      setPendingAction(null);
      setActionNote("");
    } catch (err) {
      toast({ title: "Failed to update status", description: (err instanceof Error ? err.message : String(err)), variant: "destructive" });
    }
  };

  const handleStepAction = async (stepId: string, status: string) => {
    try {
      await updateStep.mutateAsync({ pipelineId, stepId, status });
      toast({ title: "Step updated" });
    } catch (err) {
      toast({ title: "Failed to update step", description: (err instanceof Error ? err.message : String(err)), variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Skeleton className="xl:col-span-2 h-[600px] rounded-2xl" />
          <Skeleton className="h-[600px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-900">Pipeline not found</h3>
      </div>
    );
  }

  const steps = [...pipeline.steps].sort((a, b) => a.order - b.order);
  const completedCount = steps.filter((s) => s.status === "COMPLETED").length;
  const progressPct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  const createdAt = parseISO(pipeline.createdAt);
  const daysElapsed = differenceInDays(new Date(), createdAt);

  const availableTransitions = FACILITATOR_TRANSITIONS[pipeline.status] ?? [];

  const isWaiting = pipeline.status === "WAITING";
  const isRectification = pipeline.status === "RECTIFICATION";
  const isTerminal = pipeline.status === "COMPLETED" || pipeline.status === "REJECTED";

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Back link */}
      <Link href="/facilitator">
        <button className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Pipelines
        </button>
      </Link>

      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 truncate">
                {pipeline.company.name}
              </h1>
              <StatusBadge status={pipeline.status} className="text-sm px-3 py-1" />
              <Badge variant="outline" className="text-xs text-slate-500 border-slate-200 font-normal">
                {entityTypeLabel(pipeline.company.entityType)}
              </Badge>
            </div>
            <p className="text-slate-500 font-medium">
              Customer: {pipeline.customer?.name ?? "—"}
            </p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-sm text-slate-600">
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
                <Building2 className="w-4 h-4 text-slate-400" />
                {pipeline.company.city}, {pipeline.company.state}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                {daysElapsed}d elapsed · Started {format(createdAt, "dd MMM yyyy")}
              </div>
            </div>

            {/* Special status banners */}
            {isWaiting && pipeline.rectificationNotes && (
              <div className="mt-4 p-3 rounded-xl bg-purple-50 border border-purple-200 text-sm text-purple-800 flex items-start gap-2">
                <Hourglass className="w-4 h-4 shrink-0 mt-0.5 text-purple-600" />
                <span><strong>Waiting reason:</strong> {pipeline.rectificationNotes}</span>
              </div>
            )}
            {isRectification && (
              <div className="mt-4 p-3 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-orange-600" />
                <span>
                  <strong>Rectification required.</strong>{" "}
                  {pipeline.rectificationNotes
                    ? pipeline.rectificationNotes
                    : "Please review the issues and take action."}
                </span>
              </div>
            )}
            {pipeline.status === "REJECTED" && pipeline.rejectionReason && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span><strong>Rejection reason:</strong> {pipeline.rejectionReason}</span>
              </div>
            )}
          </div>

          {/* Progress & Actions */}
          <div className="shrink-0 flex flex-col gap-4 w-full md:w-auto md:min-w-[220px]">
            {/* Progress */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Progress</span>
                <span className="text-sm font-bold text-slate-900">{completedCount}/{steps.length}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2 text-right">{progressPct}% complete</p>
            </div>

            {/* Status Transition Actions */}
            {!isTerminal && availableTransitions.length > 0 && (
              <div className="flex flex-col gap-2">
                {availableTransitions.map((action) => (
                  <Button
                    key={action.status}
                    variant={action.variant}
                    size="sm"
                    className="gap-2 w-full"
                    onClick={() => {
                      setPendingAction(action);
                      setActionNote("");
                    }}
                    disabled={updateStatus.isPending}
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
            {isTerminal && (
              <div className="text-center text-sm text-slate-400 py-2">
                This pipeline is {pipeline.status.toLowerCase()}.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Steps */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-display text-slate-900">Registration Steps</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Mark each step as you complete it during the company registration process.
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-3 overflow-y-auto flex-1 max-h-[600px]">
            {steps.map((step, idx) => {
              const isCompleted = step.status === "COMPLETED";
              const isInProgress = step.status === "IN_PROGRESS";
              const isPending = step.status === "PENDING";
              const isSkipped = step.status === "SKIPPED";

              return (
                <div
                  key={step.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCompleted
                      ? "bg-emerald-50/40 border-emerald-100"
                      : isInProgress
                      ? "bg-blue-50/40 border-blue-200 shadow-sm"
                      : isSkipped
                      ? "bg-slate-50/60 border-dashed border-slate-200 opacity-60"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex gap-4 items-start min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-600"
                            : isInProgress
                            ? "bg-blue-100 text-blue-600"
                            : isSkipped
                            ? "bg-slate-100 text-slate-400"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                      </div>
                      <div className="min-w-0">
                        <h4
                          className={`font-semibold text-sm ${
                            isCompleted
                              ? "text-slate-400 line-through"
                              : isSkipped
                              ? "text-slate-400"
                              : "text-slate-900"
                          }`}
                        >
                          {step.stepName}
                        </h4>
                        {step.description && (
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                            {step.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0 ml-auto">
                      {isPending && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 hover:text-blue-700 border-blue-200 bg-blue-50/50 text-xs"
                            onClick={() => handleStepAction(step.id, "IN_PROGRESS")}
                            disabled={updateStep.isPending || isTerminal}
                          >
                            <Play className="w-3.5 h-3.5 mr-1" /> Start
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                            onClick={() => handleStepAction(step.id, "COMPLETED")}
                            disabled={updateStep.isPending || isTerminal}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Done
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-400 hover:text-slate-600 text-xs"
                            onClick={() => handleStepAction(step.id, "SKIPPED")}
                            disabled={updateStep.isPending || isTerminal}
                          >
                            Skip
                          </Button>
                        </>
                      )}
                      {isInProgress && (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                            onClick={() => handleStepAction(step.id, "COMPLETED")}
                            disabled={updateStep.isPending || isTerminal}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Mark Done
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-400 hover:text-slate-600 text-xs"
                            onClick={() => handleStepAction(step.id, "PENDING")}
                            disabled={updateStep.isPending || isTerminal}
                          >
                            Reset
                          </Button>
                        </>
                      )}
                      {isCompleted && (
                        <>
                          <span className="text-xs font-medium text-emerald-600 flex items-center px-2.5 py-1.5 bg-emerald-50 rounded-lg">
                            <Check className="w-3 h-3 mr-1" /> Completed
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-400 hover:text-slate-600 text-xs"
                            onClick={() => handleStepAction(step.id, "PENDING")}
                            disabled={updateStep.isPending || isTerminal}
                          >
                            Undo
                          </Button>
                        </>
                      )}
                      {isSkipped && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-500 hover:text-slate-700 text-xs"
                          onClick={() => handleStepAction(step.id, "PENDING")}
                          disabled={updateStep.isPending || isTerminal}
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chatter */}
        <div className="h-[700px]">
          <Chatter pipelineId={pipelineId} />
        </div>
      </div>

      {/* Status Transition Dialog */}
      <Dialog
        open={!!pendingAction}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
            setActionNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingAction?.label}</DialogTitle>
            <DialogDescription>{pendingAction?.description}</DialogDescription>
          </DialogHeader>

          {pendingAction?.noteLabel && (
            <div className="space-y-2 py-2">
              <Label className="text-sm font-medium text-slate-700">
                {pendingAction.noteLabel}
                {pendingAction.noteRequired && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </Label>
              <Textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Add a note..."
                className="min-h-[100px] resize-none"
                autoFocus
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPendingAction(null);
                setActionNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant={pendingAction?.variant ?? "default"}
              onClick={handleStatusTransition}
              disabled={
                updateStatus.isPending ||
                (!!pendingAction?.noteRequired && !actionNote.trim())
              }
            >
              {updateStatus.isPending ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
