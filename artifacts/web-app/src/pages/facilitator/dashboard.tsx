import { useCompanies } from "@/hooks/use-companies";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "wouter";
import { Building, MapPin, ArrowRight, ClipboardList } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function FacilitatorDashboard() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const { data: response, isLoading } = useCompanies({ status: statusFilter === "ALL" ? "" : statusFilter });

  const companies = response?.data || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Assigned Pipelines</h1>
          <p className="text-slate-500 mt-1">Manage and execute company registrations.</p>
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="ASSIGNED">Assigned (New)</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="WAITING">Waiting on Gov</SelectItem>
            <SelectItem value="RECTIFICATION">Rectification</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
          <ClipboardList className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No pipelines assigned</h3>
          <p className="text-slate-500 mt-2">You currently have no pipelines matching this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map(company => (
            <Link key={company.id} href={`/facilitator/pipeline/${company.pipeline?.id}`}>
              <Card className="p-6 h-full flex flex-col hover-lift cursor-pointer bg-white border-slate-200 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Building className="w-5 h-5 text-blue-600" />
                  </div>
                  {company.pipeline?.status && <StatusBadge status={company.pipeline.status} />}
                </div>
                <h3 className="font-semibold text-lg text-slate-900 group-hover:text-primary transition-colors line-clamp-1">{company.name}</h3>
                <p className="text-sm text-slate-500 mt-1">Customer: {company.customer?.name}</p>
                
                <div className="mt-6 flex items-center text-sm text-slate-600 gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{company.city}, {company.state}</span>
                </div>
                
                <div className="mt-auto pt-6 flex justify-between items-center text-sm font-medium text-primary">
                  Execute Pipeline
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
