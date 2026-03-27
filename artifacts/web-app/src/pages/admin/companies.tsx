import { useCompanies } from "@/hooks/use-companies";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "wouter";
import { ArrowRight, MapPin, Building2, UserCircle } from "lucide-react";

export default function AdminCompanies() {
  const { data: response, isLoading } = useCompanies();
  const companies = response?.data || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold font-display text-slate-900">All Companies</h1>
        <p className="text-slate-500 mt-1">Full registry of companies and their pipeline states.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4">
          {companies.map(company => (
            <Link key={company.id} href={`/dashboard/company/${company.id}`}>
              <Card className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover-lift cursor-pointer bg-white border-slate-200 group transition-all">
                <div className="flex gap-5 items-center flex-1">
                  <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-lg text-slate-900 group-hover:text-primary transition-colors">{company.name}</h3>
                      {company.pipeline?.status && <StatusBadge status={company.pipeline.status} />}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                      <span className="flex items-center gap-1.5"><UserCircle className="w-4 h-4" /> {company.customer?.name}</span>
                      <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {company.city}</span>
                    </div>
                  </div>
                </div>
                
                <div className="shrink-0 flex items-center gap-4">
                  {company.pipeline?.assignedFacilitatorId ? (
                     <div className="text-right hidden sm:block">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Facilitator</p>
                        <p className="text-sm font-medium text-slate-700">{company.pipeline?.assignedFacilitator?.name || 'Assigned'}</p>
                     </div>
                  ) : (
                    <span className="text-xs font-medium px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200">Needs Assignment</span>
                  )}
                  <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
