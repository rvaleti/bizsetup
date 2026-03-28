import { useAdminStats } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Building2, Users, FileCheck, CalendarDays, TrendingUp } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  NEW: "#94a3b8",
  ASSIGNED: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  WAITING: "#a855f7",
  COMPLETED: "#10b981",
  REJECTED: "#ef4444",
  RECTIFICATION: "#f97316",
};

const AGE_BUCKET_COLORS: Record<string, string> = {
  "0-7d": "#10b981",
  "8-14d": "#f59e0b",
  "15-30d": "#f97316",
  "31-60d": "#ef4444",
  "60d+": "#7c3aed",
};

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
        </div>
      </div>
    );
  }
  if (!stats) return null;

  const statusData = Object.entries(stats.byStatus).map(([name, value]) => ({ name, value }));
  const entityData = Object.entries(stats.byEntityType).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
  }));

  const ageDistData = (stats.ageDistribution ?? []).map((d) => ({
    range: d.range,
    count: d.count,
    fill: AGE_BUCKET_COLORS[d.range] ?? "#94a3b8",
  }));

  const totalPipelines = Object.values(stats.byStatus).reduce((a, b) => a + b, 0);
  const activePipelines =
    (stats.byStatus["NEW"] ?? 0) +
    (stats.byStatus["ASSIGNED"] ?? 0) +
    (stats.byStatus["IN_PROGRESS"] ?? 0) +
    (stats.byStatus["WAITING"] ?? 0) +
    (stats.byStatus["RECTIFICATION"] ?? 0);

  const kpis = [
    {
      label: "Total Companies",
      value: stats.totalCompanies,
      icon: Building2,
      color: "bg-blue-50 text-blue-600",
      sub: `${stats.companiesThisMonth} new this month`,
    },
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "bg-purple-50 text-purple-600",
      sub: `${stats.totalFacilitators} facilitator${stats.totalFacilitators !== 1 ? "s" : ""}`,
    },
    {
      label: "Active Pipelines",
      value: activePipelines,
      icon: TrendingUp,
      color: "bg-emerald-50 text-emerald-600",
      sub: `${totalPipelines} total`,
    },
    {
      label: "Avg. Pipeline Age",
      value: `${stats.avgPipelineAgeDays}d`,
      icon: FileCheck,
      color: "bg-orange-50 text-orange-600",
      sub: stats.avgPipelineAgeDays > 30 ? "Above 30d — needs review" : "Within normal range",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold font-display text-slate-900">Platform Overview</h1>
        <p className="text-slate-500 mt-1">High-level statistics and metrics across the entire platform.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-6 bg-white border-slate-200 hover-lift">
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl ${kpi.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-0.5">{kpi.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{kpi.sub}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Status Donut */}
        <Card className="p-6 border-slate-200 bg-white">
          <h3 className="font-bold text-lg mb-1">Pipelines by Status</h3>
          <p className="text-sm text-slate-400 mb-6">Current breakdown across all pipelines</p>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.name] ?? "#94a3b8" }} />
                {s.name} ({s.value})
              </div>
            ))}
          </div>
        </Card>

        {/* Pipeline Age Distribution */}
        <Card className="p-6 border-slate-200 bg-white">
          <h3 className="font-bold text-lg mb-1">Pipeline Age Distribution</h3>
          <p className="text-sm text-slate-400 mb-6">How long pipelines have been open</p>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageDistData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  formatter={(value: number) => [value, "Pipelines"]}
                />
                <Bar dataKey="count" name="Pipelines" radius={[6, 6, 0, 0]}>
                  {ageDistData.map((entry, index) => (
                    <Cell key={`age-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {ageDistData.map((d) => (
              <div key={d.range} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                {d.range} ({d.count})
              </div>
            ))}
          </div>
        </Card>

        {/* Entity Type Bar Chart */}
        <Card className="p-6 border-slate-200 bg-white">
          <h3 className="font-bold text-lg mb-1">Companies by Entity Type</h3>
          <p className="text-sm text-slate-400 mb-6">Registration count per business structure</p>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={entityData} margin={{ top: 10, right: 10, left: -20, bottom: 60 }}>
                <XAxis dataKey="name" angle={-40} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                />
                <Bar dataKey="value" name="Companies" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Facilitator Workload */}
        <Card className="p-6 border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-lg">Facilitator Workload</h3>
              <p className="text-sm text-slate-400 mt-0.5">Active pipelines assigned per facilitator</p>
            </div>
            <Link href="/admin/users">
              <span className="text-sm font-medium text-primary hover:underline cursor-pointer">Manage users →</span>
            </Link>
          </div>
          {stats.facilitatorWorkload.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No facilitators with active pipelines yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stats.facilitatorWorkload.map((fw) => {
                const count = fw.assignedCount;
                const load = count > 5 ? "high" : count > 2 ? "medium" : "low";
                const loadColor =
                  load === "high" ? "text-red-600 bg-red-50 border-red-100" :
                  load === "medium" ? "text-orange-600 bg-orange-50 border-orange-100" :
                  "text-emerald-600 bg-emerald-50 border-emerald-100";
                return (
                  <div
                    key={fw.facilitator?.id ?? "unassigned"}
                    className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {fw.facilitator?.name ?? "Unassigned"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">Active pipelines</p>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ml-3 border ${loadColor}`}>
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Monthly Companies */}
      <Card className="p-6 border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-bold text-lg">New Companies This Month</h3>
            <p className="text-sm text-slate-400 mt-0.5">Companies registered since the beginning of the month</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-primary">{stats.companiesThisMonth}</p>
            <p className="text-xs text-slate-400 mt-0.5">of {stats.totalCompanies} total</p>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: stats.totalCompanies > 0 ? `${Math.min(100, (stats.companiesThisMonth / stats.totalCompanies) * 100)}%` : "0%" }}
          />
        </div>
      </Card>
    </div>
  );
}
