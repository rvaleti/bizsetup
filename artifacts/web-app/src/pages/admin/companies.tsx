import { useState, useMemo } from "react";
import { useCompanies } from "@/hooks/use-companies";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Search, Building2, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const STATUSES = ["ALL", "NEW", "ASSIGNED", "IN_PROGRESS", "WAITING", "COMPLETED", "REJECTED", "RECTIFICATION"];
const ENTITY_TYPES = ["ALL", "LLP", "PRIVATE_LIMITED", "OPC", "PARTNERSHIP", "SOLE_PROPRIETORSHIP", "SECTION_8", "PUBLIC_LIMITED"];
const PAGE_SIZE = 15;

export default function AdminCompanies() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [entityType, setEntityType] = useState("ALL");
  const [page, setPage] = useState(1);
  const [, navigate] = useLocation();

  const queryParams = useMemo<{ status?: string; entityType?: string; search?: string; page: string; pageSize: string }>(() => ({
    ...(search ? { search } : {}),
    ...(status !== "ALL" ? { status } : {}),
    ...(entityType !== "ALL" ? { entityType } : {}),
    page: String(page),
    pageSize: String(PAGE_SIZE),
  }), [search, status, entityType, page]);

  const { data: response, isLoading } = useCompanies(queryParams);
  const companies = response?.data || [];
  const totalPages = response?.totalPages ?? 1;
  const total = response?.total ?? 0;

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  const handleEntityTypeChange = (val: string) => {
    setEntityType(val);
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold font-display text-slate-900">All Companies</h1>
        <p className="text-slate-500 mt-1">Full registry of all company registrations across the platform.</p>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-white border-slate-200">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by company name or customer..."
              className="pl-9 bg-white"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-[160px] bg-white">
                <Filter className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{s === "ALL" ? "All Statuses" : s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={entityType} onValueChange={handleEntityTypeChange}>
              <SelectTrigger className="w-full sm:w-[200px] bg-white">
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map(et => (
                  <SelectItem key={et} value={et}>{et === "ALL" ? "All Entity Types" : et.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="bg-white border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm text-slate-500 font-medium">
            {isLoading ? "Loading..." : `${total} companies found`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4 hidden md:table-cell">Entity Type</th>
                <th className="px-6 py-4 hidden lg:table-cell">Customer</th>
                <th className="px-6 py-4 hidden lg:table-cell">Facilitator</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 hidden md:table-cell text-right">Days Open</th>
                <th className="px-6 py-4 hidden xl:table-cell text-right">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-6 py-4"><Skeleton className="h-5 w-full rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <Building2 className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-500 font-medium">No companies found</p>
                    <p className="text-sm text-slate-400 mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                companies.map((company) => {
                  const pipelineId = company.pipeline?.id;
                  const daysOpen = company.pipeline
                    ? differenceInDays(new Date(), new Date(company.pipeline.createdAt))
                    : differenceInDays(new Date(), new Date(company.createdAt));
                  const lastUpdated = company.pipeline
                    ? formatDistanceToNow(new Date(company.pipeline.updatedAt), { addSuffix: true })
                    : formatDistanceToNow(new Date(company.updatedAt), { addSuffix: true });

                  const handleRowClick = () => {
                    if (pipelineId) navigate(`/admin/pipeline/${pipelineId}`);
                  };

                  return (
                    <tr
                      key={company.id}
                      onClick={handleRowClick}
                      className={`hover:bg-slate-50/70 transition-colors group ${pipelineId ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className={`font-semibold text-slate-900 ${pipelineId ? "group-hover:text-primary" : ""} transition-colors`}>
                              {company.name}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5 md:hidden">{company.entityType.replace(/_/g, " ")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-slate-600">
                        <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded-md">
                          {company.entityType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell text-slate-600">
                        {company.customer?.name ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell text-slate-600">
                        {company.pipeline?.assignedFacilitator?.name ?? (
                          <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {company.pipeline?.status ? (
                          <StatusBadge status={company.pipeline.status} />
                        ) : (
                          <span className="text-slate-400 text-xs">No pipeline</span>
                        )}
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-right">
                        <span className={`font-semibold tabular-nums ${daysOpen > 30 ? "text-red-600" : daysOpen > 14 ? "text-orange-500" : "text-slate-700"}`}>
                          {daysOpen}d
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden xl:table-cell text-right text-slate-400 text-xs">
                        {lastUpdated}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
