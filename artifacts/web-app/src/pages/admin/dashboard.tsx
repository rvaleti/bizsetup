import { useAdminStats } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Building2, Users, FileCheck, CalendarDays } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) return <div className="space-y-6"><div className="grid grid-cols-4 gap-6">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div></div>;
  if (!stats) return null;

  const STATUS_COLORS: Record<string, string> = {
    NEW: "#94a3b8",
    ASSIGNED: "#3b82f6",
    IN_PROGRESS: "#f59e0b",
    WAITING: "#a855f7",
    COMPLETED: "#10b981",
    REJECTED: "#ef4444",
    RECTIFICATION: "#f97316"
  };

  const statusData = Object.entries(stats.byStatus).map(([name, value]) => ({ name, value }));
  const entityData = Object.entries(stats.byEntityType).map(([name, value]) => ({ name: name.replace('_', ' '), value }));

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold font-display text-slate-900">Platform Overview</h1>
        <p className="text-slate-500 mt-1">High-level statistics and metrics across the platform.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-white border-slate-200 flex items-center gap-4 hover-lift">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Companies</p>
            <p className="text-3xl font-bold text-slate-900">{stats.totalCompanies}</p>
          </div>
        </Card>
        <Card className="p-6 bg-white border-slate-200 flex items-center gap-4 hover-lift">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CalendarDays className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">New This Month</p>
            <p className="text-3xl font-bold text-slate-900">{stats.companiesThisMonth}</p>
          </div>
        </Card>
        <Card className="p-6 bg-white border-slate-200 flex items-center gap-4 hover-lift">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Users</p>
            <p className="text-3xl font-bold text-slate-900">{stats.totalUsers}</p>
          </div>
        </Card>
        <Card className="p-6 bg-white border-slate-200 flex items-center gap-4 hover-lift">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600">
            <FileCheck className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Avg. Pipeline Age</p>
            <p className="text-3xl font-bold text-slate-900">{stats.avgPipelineAgeDays}d</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border-slate-200 bg-white">
          <h3 className="font-bold text-lg mb-6">Pipelines by Status</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || "#000"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 justify-center mt-4">
            {statusData.map(s => (
              <div key={s.name} className="flex items-center gap-2 text-xs font-medium">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.name] }} />
                {s.name} ({s.value})
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 border-slate-200 bg-white">
          <h3 className="font-bold text-lg mb-6">Companies by Entity Type</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={entityData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-6 border-slate-200 bg-white">
          <h3 className="font-bold text-lg mb-6">Facilitator Workload</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {stats.facilitatorWorkload.map(fw => (
              <div key={fw.facilitator?.id || 'unassigned'} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-slate-900">{fw.facilitator?.name || 'Unassigned'}</p>
                  <p className="text-xs text-slate-500">Active Pipelines</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {fw.assignedCount}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
