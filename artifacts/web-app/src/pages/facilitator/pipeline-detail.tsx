import { usePipeline, useUpdatePipelineStatus, useUpdatePipelineStep } from "@/hooks/use-pipelines";
import { useRoute } from "wouter";
import { StatusBadge } from "@/components/status-badge";
import { Chatter } from "@/components/chatter";
import { Button } from "@/components/ui/button";
import { Building2, Phone, Mail, Check, Play, SkipForward } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function FacilitatorPipelineDetail() {
  const [, params] = useRoute("/facilitator/pipeline/:id");
  const pipelineId = params?.id || "";
  
  const { data: pipeline, isLoading } = usePipeline(pipelineId);
  const updateStatus = useUpdatePipelineStatus();
  const updateStep = useUpdatePipelineStep();
  const { toast } = useToast();

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-40 w-full rounded-2xl" /></div>;
  if (!pipeline) return <div>Pipeline not found</div>;

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ pipelineId, status: newStatus });
      toast({ title: "Status updated" });
    } catch (err) {
      toast({ title: "Failed to update", description: (err instanceof Error ? err.message : String(err)), variant: "destructive" });
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

  const steps = [...pipeline.steps].sort((a,b) => a.order - b.order);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header Info */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold font-display text-slate-900">{pipeline.company.name}</h1>
            <StatusBadge status={pipeline.status} className="text-sm px-3 py-1" />
          </div>
          <p className="text-slate-500 font-medium">Customer: {pipeline.customer?.name} • {pipeline.company.entityType}</p>
          
          <div className="flex items-center gap-6 mt-4 text-sm text-slate-600">
            <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> {pipeline.company.primaryPhone}</div>
            {pipeline.company.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /> {pipeline.company.email}</div>}
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-sm font-medium text-slate-600">Pipeline Status:</span>
          <Select value={pipeline.status} onValueChange={handleStatusChange} disabled={updateStatus.isPending}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ASSIGNED">Assigned</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="WAITING">Waiting on Gov</SelectItem>
              <SelectItem value="RECTIFICATION">Rectification</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[700px]">
        {/* Execution Stepper */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xl font-bold font-display text-slate-900">Execution Steps</h2>
            <p className="text-sm text-slate-500 mt-1">Mark steps as complete as you finish them.</p>
          </div>
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {steps.map(step => {
              const isCompleted = step.status === "COMPLETED";
              const isInProgress = step.status === "IN_PROGRESS";
              const isPending = step.status === "PENDING";
              
              return (
                <div key={step.id} className={`p-4 rounded-xl border ${isCompleted ? 'bg-emerald-50/30 border-emerald-100' : isInProgress ? 'bg-blue-50/30 border-blue-200 shadow-sm' : 'bg-white border-slate-200'} flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-all`}>
                  <div className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isCompleted ? 'bg-emerald-100 text-emerald-600' : isInProgress ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                      {isCompleted ? <Check className="w-5 h-5" /> : step.order}
                    </div>
                    <div>
                      <h4 className={`font-semibold ${isCompleted ? 'text-slate-600 line-through' : 'text-slate-900'}`}>{step.stepName}</h4>
                      {step.description && <p className="text-sm text-slate-500 mt-1">{step.description}</p>}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
                    {isPending && (
                      <Button size="sm" variant="outline" className="text-blue-600 hover:text-blue-700 bg-blue-50/50" onClick={() => handleStepAction(step.id, "IN_PROGRESS")} disabled={updateStep.isPending}>
                        <Play className="w-4 h-4 mr-1.5" /> Start
                      </Button>
                    )}
                    {(isPending || isInProgress) && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStepAction(step.id, "COMPLETED")} disabled={updateStep.isPending}>
                        <Check className="w-4 h-4 mr-1.5" /> Done
                      </Button>
                    )}
                    {isPending && (
                      <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-600" onClick={() => handleStepAction(step.id, "SKIPPED")} disabled={updateStep.isPending}>
                        Skip
                      </Button>
                    )}
                    {isCompleted && (
                      <span className="text-sm font-medium text-emerald-600 flex items-center px-3 py-1.5 bg-emerald-50 rounded-lg">Completed</span>
                    )}
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
    </div>
  );
}
