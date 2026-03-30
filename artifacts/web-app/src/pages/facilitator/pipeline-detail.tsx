import {
  usePipeline,
  useUpdatePipelineStatus,
  useUpdatePipelineStep,
  useRequestMoreInfo,
  useRectify,
  useResubmit,
} from "@/hooks/use-pipelines";
import { useLocation, Link } from "wouter";
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
  MessageSquarePlus,
  Send,
  UserCircle2,
  Wrench,
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
  RE_SUBMITTED: [
    {
      status: "WAITING",
      label: "Mark Waiting on Gov",
      description: "Waiting for the government to respond after re-submission.",
      variant: "outline",
      noteLabel: "Any notes?",
      icon: <Hourglass className="w-4 h-4" />,
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
  console.log("[INIT] FacilitatorPipelineDetail component loaded");
  const [location] = useLocation();
  
  // Extract pipeline ID from URL - handles /facilitator/pipeline/[id]
  const pipelineId = location.includes("/facilitator/pipeline/") 
    ? location.split("/facilitator/pipeline/")[1]?.split("?")[0] || ""
    : location.split("/").pop() || "";

  console.log("[DEBUG] FacilitatorPipelineDetail:", { location, pipelineId, locationParts: location.split("/") });

  const { data: pipeline, isLoading } = usePipeline(pipelineId);
  const updateStatus = useUpdatePipelineStatus();
  const updateStep = useUpdatePipelineStep();
  const requestMoreInfo = useRequestMoreInfo();
  const rectify = useRectify();
  const resubmit = useResubmit();
  const { toast } = useToast();

  const [pendingAction, setPendingAction] = useState<TransitionAction | null>(null);
  const [actionNote, setActionNote] = useState("");

  const [moreInfoOpen, setMoreInfoOpen] = useState(false);
  const [moreInfoText, setMoreInfoText] = useState("");

  const [rectifyOpen, setRectifyOpen] = useState(false);
  const [rectifyText, setRectifyText] = useState("");

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
      toast({
        title: "Failed to update status",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const handleStepAction = async (stepId: string, status: string) => {
    try {
      await updateStep.mutateAsync({ pipelineId, stepId, status });
      toast({ title: "Step updated" });
    } catch (err) {
      toast({
        title: "Failed to update step",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const handleMoreInfoSubmit = async () => {
    if (!moreInfoText.trim()) return;
    try {
      await requestMoreInfo.mutateAsync({ pipelineId, details: moreInfoText });
      toast({ title: "More information requested", description: "Customer has been notified" });
      setMoreInfoOpen(false);
      setMoreInfoText("");
    } catch (err) {
      toast({
        title: "Failed to send request",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const handleRectifySubmit = async () => {
    if (!rectifyText.trim()) return;
    try {
      await rectify.mutateAsync({ pipelineId, notes: rectifyText });
      toast({ title: "Rectification raised", description: "Pipeline moved to Rectification status" });
      setRectifyOpen(false);
      setRectifyText("");
    } catch (err) {
      toast({
        title: "Failed to raise rectification",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const handleResubmit = async () => {
    try {
      await resubmit.mutateAsync({ pipelineId });
      toast({ title: "Re-submitted", description: "Pipeline marked as re-submitted to the government" });
    } catch (err) {
      toast({
        title: "Failed to mark re-submission",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
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
  const isReSubmitted = pipeline.status === "RE_SUBMITTED";
  const isTerminal = pipeline.status === "COMPLETED" || pipeline.status === "REJECTED";

  const canRequestMoreInfo = !isTerminal && (
    pipeline.status === "IN_PROGRESS" ||
    pipeline.status === "WAITING" ||
    pipeline.status === "ASSIGNED"
  );
  const canRectify = !isTerminal && pipeline.status !== "RECTIFICATION";
  const canResubmit = pipeline.status === "RECTIFICATION";

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

            {/* Status banners */}
            {isWaiting && pipeline.rectificationNotes && (
              <div className="mt-4 p-3 rounded-xl bg-purple-50 border border-purple-200 text-sm text-purple-800 flex items-start gap-2">
                <Hourglass className="w-4 h-4 shrink-0 mt-0.5 text-purple-600" />
                <span>
                  <strong>Waiting reason:</strong> {pipeline.rectificationNotes}
                </span>
              </div>
            )}
            {isRectification && (
              <div className="mt-4 p-3 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-orange-600" />
                <span>
                  <strong>Rectification required.</strong>{" "}
                  {pipeline.rectificationNotes ?? "Please review the issues and take action."}
                </span>
              </div>
            )}
            {isReSubmitted && (
              <div className="mt-4 p-3 rounded-xl bg-teal-50 border border-teal-200 text-sm text-teal-800 flex items-start gap-2">
                <Send className="w-4 h-4 shrink-0 mt-0.5 text-teal-600" />
                <span>
                  <strong>Application Re-Submitted.</strong> Awaiting government response.
                </span>
              </div>
            )}
            {pipeline.status === "REJECTED" && pipeline.rejectionReason && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>
                  <strong>Rejection reason:</strong> {pipeline.rejectionReason}
                </span>
              </div>
            )}
          </div>

          {/* Progress & Actions */}
          <div className="shrink-0 flex flex-col gap-3 w-full md:w-auto md:min-w-[220px]">
            {/* Progress */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Progress
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {completedCount}/{steps.length}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2 text-right">{progressPct}% complete</p>
            </div>

            {/* Pipeline Status Transitions */}
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

            {/* Special Actions */}
            {!isTerminal && (
              <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                {canRectify && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full text-orange-600 border-orange-200 hover:bg-orange-50"
                    onClick={() => setRectifyOpen(true)}
                    disabled={rectify.isPending}
                  >
                    <Wrench className="w-4 h-4" />
                    Raise Rectification
                  </Button>
                )}
                {canResubmit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full text-teal-600 border-teal-200 hover:bg-teal-50"
                    onClick={handleResubmit}
                    disabled={resubmit.isPending}
                  >
                    <Send className="w-4 h-4" />
                    {resubmit.isPending ? "Re-submitting..." : "Mark Re-Submitted"}
                  </Button>
                )}
                {canRequestMoreInfo && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => setMoreInfoOpen(true)}
                    disabled={requestMoreInfo.isPending}
                  >
                    <MessageSquarePlus className="w-4 h-4" />
                    Request More Info
                  </Button>
                )}
              </div>
            )}

            {isTerminal && (
              <div className="text-center text-sm text-slate-400 py-2">
                This pipeline is {pipeline.status.toLowerCase().replace("_", " ")}.
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
              const isWaitingStep = step.status === "WAITING";

              const assignedToCustomer = step.assignedTo === "CUSTOMER";

              return (
                <div
                  key={step.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCompleted
                      ? "bg-emerald-50/40 border-emerald-100"
                      : isInProgress
                      ? "bg-blue-50/40 border-blue-200 shadow-sm"
                      : isWaitingStep
                      ? "bg-purple-50/40 border-purple-200"
                      : isSkipped
                      ? "bg-slate-50/60 border-dashed border-slate-200 opacity-60"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex gap-4 items-start min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-600"
                            : isInProgress
                            ? "bg-blue-100 text-blue-600"
                            : isWaitingStep
                            ? "bg-purple-100 text-purple-600"
                            : isSkipped
                            ? "bg-slate-100 text-slate-400"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
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
                          {step.assignedTo && (
                            <Badge
                              variant="outline"
                              className={`text-xs py-0 px-2 ${
                                assignedToCustomer
                                  ? "text-sky-600 border-sky-200 bg-sky-50"
                                  : "text-violet-600 border-violet-200 bg-violet-50"
                              }`}
                            >
                              <UserCircle2 className="w-3 h-3 mr-1" />
                              {assignedToCustomer ? "Customer" : "Facilitator"}
                            </Badge>
                          )}
                          {isWaitingStep && (
                            <Badge variant="outline" className="text-xs text-purple-600 border-purple-200 bg-purple-50 py-0 px-2">
                              <Hourglass className="w-3 h-3 mr-1" /> Waiting
                            </Badge>
                          )}
                        </div>
                        {step.description && (
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                            {step.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0 ml-auto">
                      {isPending && !assignedToCustomer && (
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
                      {isPending && assignedToCustomer && (
                        <span className="text-xs text-sky-600 flex items-center gap-1 px-2 py-1 bg-sky-50 rounded-lg border border-sky-100">
                          <UserCircle2 className="w-3 h-3" /> Awaiting customer
                        </span>
                      )}
                      {isInProgress && !assignedToCustomer && (
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
                      {isInProgress && assignedToCustomer && (
                        <>
                          <span className="text-xs text-sky-600 flex items-center gap-1 px-2 py-1 bg-sky-50 rounded-lg border border-sky-100">
                            <UserCircle2 className="w-3 h-3" /> Awaiting customer
                          </span>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                            onClick={() => handleStepAction(step.id, "COMPLETED")}
                            disabled={updateStep.isPending || isTerminal}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Done
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
                      {isWaitingStep && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                          onClick={() => handleStepAction(step.id, "COMPLETED")}
                          disabled={updateStep.isPending || isTerminal}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Mark Done
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
                {pendingAction.noteRequired && <span className="text-red-500 ml-1">*</span>}
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

      {/* Request More Info Dialog */}
      <Dialog open={moreInfoOpen} onOpenChange={setMoreInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request More Information</DialogTitle>
            <DialogDescription>
              Describe what additional information or documents you need from the customer. They will
              be notified by email and in-app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm font-medium text-slate-700">
              What do you need? <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={moreInfoText}
              onChange={(e) => setMoreInfoText(e.target.value)}
              placeholder="e.g. Please provide a copy of the PAN card and proof of registered office address..."
              className="min-h-[120px] resize-none"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMoreInfoOpen(false);
                setMoreInfoText("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMoreInfoSubmit}
              disabled={requestMoreInfo.isPending || !moreInfoText.trim()}
            >
              {requestMoreInfo.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Raise Rectification Dialog */}
      <Dialog open={rectifyOpen} onOpenChange={setRectifyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Raise Rectification</DialogTitle>
            <DialogDescription>
              Describe the government query or objection that needs to be addressed. The pipeline
              will be moved to Rectification status and a new task will be created.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-sm font-medium text-slate-700">
              Query / Objection details <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={rectifyText}
              onChange={(e) => setRectifyText(e.target.value)}
              placeholder="e.g. MCA raised a query on the director's DIN — need to resubmit Form DIR-3 with corrected address..."
              className="min-h-[120px] resize-none"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRectifyOpen(false);
                setRectifyText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleRectifySubmit}
              disabled={rectify.isPending || !rectifyText.trim()}
            >
              {rectify.isPending ? "Raising..." : "Raise Rectification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
