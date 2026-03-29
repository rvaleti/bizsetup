import { useCompany } from "@/hooks/use-companies";
import { usePipeline, useAssignFacilitator } from "@/hooks/use-pipelines";
import { useUsers } from "@/hooks/use-users";
import { useAuth } from "@/hooks/use-auth";
import { useRoute } from "wouter";
import { StatusBadge } from "@/components/status-badge";
import { PipelineStepper } from "@/components/pipeline-stepper";
import { Chatter } from "@/components/chatter";
import { Building2, MapPin, Phone, Mail, UserCircle, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function CustomerCompanyDetail() {
  const [, params] = useRoute("/dashboard/company/:id");
  const companyId = params?.id || "";
  
  const { data: user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { data: company, isLoading: companyLoading, error: companyError } = useCompany(companyId);
  const pipelineId = company?.pipeline?.id || "";
  const { data: pipeline, isLoading: pipelineLoading, error: pipelineError } = usePipeline(pipelineId);
  const { data: facilitators } = useUsers("FACILITATOR", isAdmin);
  const assignFacilitator = useAssignFacilitator();
  const { toast } = useToast();
  const [selectedFacilitatorId, setSelectedFacilitatorId] = useState("");

  const handleAssign = async () => {
    if (!selectedFacilitatorId || !pipelineId) return;
    try {
      await assignFacilitator.mutateAsync({ pipelineId, facilitatorId: selectedFacilitatorId });
      toast({ title: "Facilitator assigned successfully" });
      setSelectedFacilitatorId("");
    } catch (err) {
      toast({ title: "Failed to assign facilitator", description: err instanceof Error ? err.message : "An unexpected error occurred", variant: "destructive" });
    }
  };

  if (companyLoading) return <div className="space-y-6"><Skeleton className="h-40 w-full rounded-2xl" /><div className="flex gap-6"><Skeleton className="h-[500px] flex-1 rounded-2xl" /><Skeleton className="h-[500px] w-96 rounded-2xl" /></div></div>;
  if (companyError) return <div className="text-center py-12"><h2 className="text-red-600 font-bold mb-2">Error loading company</h2><p className="text-slate-500">{companyError instanceof Error ? companyError.message : "An error occurred"}</p></div>;
  if (!company) return <div className="text-center py-12"><h2 className="text-slate-600 font-bold mb-2">Company not found</h2><p className="text-slate-500">This company doesn't exist or you don't have access to it.</p></div>;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Building2 className="w-48 h-48" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold font-display text-slate-900">{company.name}</h1>
              {pipeline?.status && <StatusBadge status={pipeline.status} className="text-sm px-3 py-1" />}
            </div>
            <p className="text-slate-500 font-medium">{company.entityType.replace('_', ' ')}</p>
            
            <div className="flex flex-wrap items-center gap-6 mt-6 text-sm text-slate-600">
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> {company.address}, {company.city}, {company.state} - {company.pincode}</div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> {company.primaryPhone}</div>
              {company.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /> {company.email}</div>}
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            {pipeline?.assignedFacilitator ? (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-4 min-w-[250px]">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <UserCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Assigned Facilitator</p>
                  <p className="font-semibold text-slate-900">{pipeline.assignedFacilitator.name}</p>
                </div>
              </div>
            ) : null}
            
            {isAdmin && pipelineId && (
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 min-w-[250px]">
                <p className="text-xs text-orange-700 font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" />
                  {pipeline?.assignedFacilitator ? "Reassign Facilitator" : "Assign Facilitator"}
                </p>
                <div className="flex gap-2">
                  <Select value={selectedFacilitatorId} onValueChange={setSelectedFacilitatorId}>
                    <SelectTrigger className="flex-1 bg-white h-9 text-sm">
                      <SelectValue placeholder="Select facilitator" />
                    </SelectTrigger>
                    <SelectContent>
                      {facilitators?.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleAssign}
                    disabled={!selectedFacilitatorId || assignFacilitator.isPending}
                    className="shrink-0"
                  >
                    Assign
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Pipeline Stepper */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 shrink-0">
            <h2 className="text-xl font-bold font-display text-slate-900">Registration Progress</h2>
          </div>
          <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
            {pipelineLoading ? (
              <div className="space-y-8">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : pipeline?.steps && pipeline.steps.length > 0 ? (
              <PipelineStepper steps={pipeline.steps} />
            ) : !pipelineId ? (
              <div className="text-center text-slate-500 py-8">Pipeline not yet created</div>
            ) : (
              <div className="text-center text-slate-500 py-8">No steps available</div>
            )}
          </div>
        </div>

        {/* Chatter */}
        <div className="h-[600px]">
          {pipelineId && <Chatter pipelineId={pipelineId} />}
        </div>
      </div>
    </div>
  );
}
