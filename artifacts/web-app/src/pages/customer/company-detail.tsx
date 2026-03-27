import { useCompany } from "@/hooks/use-companies";
import { usePipeline } from "@/hooks/use-pipelines";
import { useRoute } from "wouter";
import { StatusBadge } from "@/components/status-badge";
import { PipelineStepper } from "@/components/pipeline-stepper";
import { Chatter } from "@/components/chatter";
import { Building2, MapPin, Phone, Mail, UserCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerCompanyDetail() {
  const [, params] = useRoute("/dashboard/company/:id");
  const companyId = params?.id || "";
  
  const { data: company, isLoading: companyLoading } = useCompany(companyId);
  const pipelineId = company?.pipeline?.id || "";
  const { data: pipeline, isLoading: pipelineLoading } = usePipeline(pipelineId);

  if (companyLoading) return <div className="space-y-6"><Skeleton className="h-40 w-full rounded-2xl" /><div className="flex gap-6"><Skeleton className="h-[500px] flex-1 rounded-2xl" /><Skeleton className="h-[500px] w-96 rounded-2xl" /></div></div>;
  if (!company) return <div>Company not found</div>;

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
          
          {pipeline?.assignedFacilitator && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-4 min-w-[250px]">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <UserCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Assigned Facilitator</p>
                <p className="font-semibold text-slate-900">{pipeline.assignedFacilitator.name}</p>
              </div>
            </div>
          )}
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
            ) : pipeline?.steps ? (
              <PipelineStepper steps={pipeline.steps} />
            ) : null}
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
