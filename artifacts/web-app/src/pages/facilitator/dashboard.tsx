import { useCompanies } from "@/hooks/use-companies";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "wouter";
import { Building, ArrowRight, ClipboardList, Clock, User } from "lucide-react";
import { useState } from "react";
import { differenceInDays, parseISO } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const STATUS_TABS = [
  { value: "ALL", label: "All" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "WAITING", label: "Waiting" },
  { value: "RECTIFICATION", label: "Rectification" },
  { value: "COMPLETED", label: "Completed" },
];

function entityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    PRIVATE_LIMITED: "Pvt Ltd",
    PUBLIC_LIMITED: "Public Ltd",
    LLP: "LLP",
    OPC: "OPC",
    PARTNERSHIP: "Partnership",
    SOLE_PROPRIETORSHIP: "Sole Prop.",
    SECTION_8: "Section 8",
  };
  return labels[type] ?? type;
}

export default function FacilitatorDashboard() {
  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");

  // Fetch all assigned pipelines (no status filter) to compute accurate tab counts
  const { data: allResponse } = useCompanies({ pageSize: "200" });

  // Fetch filtered pipelines based on active tab
  const { data: response, isLoading } = useCompanies({
    status: activeTab === "ALL" ? undefined : activeTab,
  });

  // Counts always derived from the unfiltered "all" dataset — accurate regardless of active tab
  const allCompanies = allResponse?.data ?? [];
  const counts = STATUS_TABS.slice(1).reduce<Record<string, number>>((acc, tab) => {
    acc[tab.value] = allCompanies.filter(
      (c) => c.pipeline?.status === tab.value
    ).length;
    return acc;
  }, {});

  const companies = (response?.data ?? []).filter((c) => {
    if (!search.trim()) return true;
    return c.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">Assigned Pipelines</h1>
          <p className="text-slate-500 mt-1">
            Manage and execute company registrations assigned to you.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearch(""); }}>
        <TabsList className="flex-wrap h-auto gap-1 bg-slate-100/80 p-1">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-sm gap-2">
              {tab.label}
              {tab.value !== "ALL" && counts[tab.value] > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs rounded-full">
                  {counts[tab.value]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
          <ClipboardList className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No pipelines found</h3>
          <p className="text-slate-500 mt-2">
            {activeTab === "ALL"
              ? "No pipelines are currently assigned to you."
              : `No pipelines with status "${activeTab}" assigned to you.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => {
            const createdAt = company.pipeline?.createdAt
              ? parseISO(company.pipeline.createdAt)
              : null;
            const daysElapsed = createdAt ? differenceInDays(new Date(), createdAt) : null;

            return (
              <Link
                key={company.id}
                href={`/facilitator/pipeline/${company.pipeline?.id}`}
              >
                <Card className="p-6 h-full flex flex-col hover-lift cursor-pointer bg-white border-slate-200 group transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Building className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {company.pipeline?.status && (
                        <StatusBadge status={company.pipeline.status} />
                      )}
                      <Badge variant="outline" className="text-xs text-slate-500 border-slate-200 font-normal">
                        {entityTypeLabel(company.entityType)}
                      </Badge>
                    </div>
                  </div>

                  <h3 className="font-semibold text-lg text-slate-900 group-hover:text-primary transition-colors line-clamp-1">
                    {company.name}
                  </h3>

                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{company.customer?.name ?? "Unknown Customer"}</span>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                    <span>{company.city}, {company.state}</span>
                    {daysElapsed !== null && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>{daysElapsed}d elapsed</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-5 flex justify-between items-center text-sm font-medium text-primary border-t border-slate-100 mt-5">
                    Execute Pipeline
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
