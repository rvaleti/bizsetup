import { usePipeline, useUpdatePipelineStatus, useAssignFacilitator } from "@/hooks/use-pipelines";
import { useUsers } from "@/hooks/use-users";
import { useRoute, useLocation } from "wouter";
import { StatusBadge } from "@/components/status-badge";
import { Chatter } from "@/components/chatter";
import { Button } from "@/components/ui/button";
import { Building2, Phone, Mail, Check, UserCheck, XCircle, AlertTriangle, ArrowLeft, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
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
import { useState } from "react";
import { differenceInDays } from "date-fns";

export default function AdminPipelineDetail() {
  const [, params] = useRoute("/admin/pipeline/:id");
  const pipelineId = params?.id || "";
  const [, navigate] = useLocation();

  const { data: pipeline, isLoading } = usePipeline(pipelineId);
  const { data: facilitators } = useUsers("FACILITATOR");
  const updateStatus = useUpdatePipelineStatus();
  const assignFacilitator = useAssignFacilitator();
  const { toast } = useToast();

  const [rejectDialog, setRejectDialog] = useState(false);
  const [rectifyDialog, setRectifyDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rectificationNotes, setRectificationNotes] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Skeleton className="xl:col-span-2 h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!pipeline) return <div className="p-8 text-center text-slate-500">Pipeline not found.</div>;

  const steps = [...pipeline.steps].sort((a, b) => a.order - b.order);
  const daysOpen = differenceInDays(new Date(), new Date(pipeline.createdAt));

  const handleAssign = async (facilitatorId: string) => {
    try {
      await assignFacilitator.mutateAsync({ pipelineId, facilitatorId });
      toast({ title: "Facilitator assigned successfully" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to assign", description: msg, variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({ title: "Rejection reason is required", variant: "destructive" });
      return;
    }
    try {
      await updateStatus.mutateAsync({
        pipelineId,
        status: "REJECTED",
        rejectionReason,
        message: `Pipeline rejected: ${rejectionReason}`,
      });
      toast({ title: "Pipeline rejected" });
      setRejectDialog(false);
      setRejectionReason("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to reject", description: msg, variant: "destructive" });
    }
  };

  const handleRectification = async () => {
    if (!rectificationNotes.trim()) {
      toast({ title: "Rectification notes are required", variant: "destructive" });
      return;
    }
    try {
      await updateStatus.mutateAsync({
        pipelineId,
        status: "RECTIFICATION",
        rectificationNotes,
        message: `Sent for rectification: ${rectificationNotes}`,
      });
      toast({ title: "Pipeline sent for rectification" });
      setRectifyDialog(false);
      setRectificationNotes("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to send for rectification", description: msg, variant: "destructive" });
    }
  };

  const canReject = ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING", "RECTIFICATION"].includes(pipeline.status);
  const canRectify = ["IN_PROGRESS", "WAITING"].includes(pipeline.status);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="text-slate-500 hover:text-slate-900 -ml-2"
        onClick={() => navigate("/admin/companies")}
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Companies
      </Button>

      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold font-display text-slate-900">{pipeline.company.name}</h1>
              <StatusBadge status={pipeline.status} className="text-sm px-3 py-1" />
            </div>
            <p className="text-slate-500 font-medium">
              Customer: {pipeline.customer?.name ?? "Unknown"} &bull; {pipeline.company.entityType.replace(/_/g, " ")}
            </p>
            <div className="flex flex-wrap items-center gap-6 mt-4 text-sm text-slate-600">
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> {pipeline.company.primaryPhone}</div>
              {pipeline.company.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /> {pipeline.company.email}</div>}
              <div className="flex items-center gap-2 text-slate-400">
                <Building2 className="w-4 h-4" />
                <span>{pipeline.company.city}, {pipeline.company.state}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-5">
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm">
                <span className="text-slate-400 mr-1">Days open:</span>
                <span className="font-semibold text-slate-800">{daysOpen}d</span>
              </div>
              {pipeline.assignedFacilitator && (
                <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-sm flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-blue-700 font-medium">{pipeline.assignedFacilitator.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Admin Controls */}
          <div className="flex flex-col gap-3 min-w-[240px]">
            {/* Assign Facilitator */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5" /> Assign Facilitator
              </p>
              <Select
                value={pipeline.assignedFacilitatorId ?? ""}
                onValueChange={handleAssign}
                disabled={assignFacilitator.isPending || pipeline.status === "COMPLETED" || pipeline.status === "REJECTED"}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select facilitator..." />
                </SelectTrigger>
                <SelectContent>
                  {facilitators?.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              {canRectify && (
                <Button
                  variant="outline"
                  className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                  onClick={() => setRectifyDialog(true)}
                  disabled={updateStatus.isPending}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Send for Rectification
                </Button>
              )}
              {canReject && (
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setRejectDialog(true)}
                  disabled={updateStatus.isPending}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Pipeline
                </Button>
              )}
              {pipeline.status === "REJECTED" && pipeline.rejectionReason && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                  <p className="font-semibold mb-1">Rejection Reason:</p>
                  <p>{pipeline.rejectionReason}</p>
                </div>
              )}
              {pipeline.status === "RECTIFICATION" && pipeline.rectificationNotes && (
                <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-700">
                  <p className="font-semibold mb-1">Rectification Notes:</p>
                  <p>{pipeline.rectificationNotes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Steps + Chatter */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6" style={{ minHeight: '600px' }}>
        {/* Steps */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-bold font-display text-slate-900">Pipeline Steps</h2>
            <p className="text-sm text-slate-500 mt-1">Overview of registration steps and their completion status.</p>
          </div>
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {steps.map((step) => {
              const isCompleted = step.status === "COMPLETED";
              const isInProgress = step.status === "IN_PROGRESS";
              const isSkipped = step.status === "SKIPPED";
              return (
                <div
                  key={step.id}
                  className={`p-4 rounded-xl border flex gap-4 items-start transition-all ${
                    isCompleted ? "bg-emerald-50/30 border-emerald-100" :
                    isInProgress ? "bg-blue-50/30 border-blue-200" :
                    isSkipped ? "bg-slate-50 border-slate-100 opacity-60" :
                    "bg-white border-slate-200"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold ${
                    isCompleted ? "bg-emerald-100 text-emerald-600" :
                    isInProgress ? "bg-blue-100 text-blue-600" :
                    isSkipped ? "bg-slate-100 text-slate-400" :
                    "bg-slate-100 text-slate-500"
                  }`}>
                    {isCompleted ? <Check className="w-4 h-4" /> : step.order}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className={`font-semibold ${isCompleted ? "text-slate-500 line-through" : "text-slate-900"}`}>
                        {step.stepName}
                      </h4>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        isCompleted ? "bg-emerald-100 text-emerald-700" :
                        isInProgress ? "bg-blue-100 text-blue-700" :
                        isSkipped ? "bg-slate-100 text-slate-500" :
                        "bg-slate-100 text-slate-500"
                      }`}>
                        {step.status}
                      </span>
                    </div>
                    {step.description && <p className="text-sm text-slate-500 mt-1">{step.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chatter */}
        <div className="h-[600px]">
          <Chatter pipelineId={pipelineId} />
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" /> Reject Pipeline
            </DialogTitle>
            <DialogDescription>
              Rejecting this pipeline will stop all progress. This action cannot be undone. Please provide a clear reason.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="rejection-reason" className="text-slate-700 font-medium">
              Rejection Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why this pipeline is being rejected..."
              className="mt-2 min-h-[120px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(false); setRejectionReason(""); }}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleReject}
              disabled={updateStatus.isPending || !rejectionReason.trim()}
            >
              {updateStatus.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rectification Dialog */}
      <Dialog open={rectifyDialog} onOpenChange={setRectifyDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" /> Send for Rectification
            </DialogTitle>
            <DialogDescription>
              The customer or facilitator will need to make corrections before the pipeline can proceed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="rectification-notes" className="text-slate-700 font-medium">
              Rectification Instructions <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="rectification-notes"
              value={rectificationNotes}
              onChange={(e) => setRectificationNotes(e.target.value)}
              placeholder="Describe what needs to be corrected or resubmitted..."
              className="mt-2 min-h-[120px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRectifyDialog(false); setRectificationNotes(""); }}>
              Cancel
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleRectification}
              disabled={updateStatus.isPending || !rectificationNotes.trim()}
            >
              {updateStatus.isPending ? "Sending..." : "Send for Rectification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
