import { useState } from "react";
import { useUsers, useUpdateUserRole } from "@/hooks/use-users";
import { useAdminStats } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Users, Shield, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ADMIN: { label: "Admin", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Shield },
  FACILITATOR: { label: "Facilitator", color: "bg-blue-100 text-blue-700 border-blue-200", icon: UserCheck },
  CUSTOMER: { label: "Customer", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Users },
};

export default function AdminUsers() {
  const { data: users, isLoading } = useUsers();
  const { data: stats } = useAdminStats();
  const updateRole = useUpdateUserRole();
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const handleRoleChange = async (userId: string, newRole: string) => {
    setLoadingId(userId);
    try {
      await updateRole.mutateAsync({ userId, role: newRole });
      toast({ title: "Role updated successfully" });
    } catch (err) {
      toast({ title: "Failed to update role", description: (err instanceof Error ? err.message : String(err)), variant: "destructive" });
    } finally {
      setLoadingId(null);
    }
  };

  const filtered = users?.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  }) ?? [];

  const facilitatorWorkloadMap = new Map<string, number>(
    stats?.facilitatorWorkload.map((fw) => [fw.facilitator?.id ?? "", fw.assignedCount]) ?? []
  );

  const admins = filtered.filter((u) => u.role === "ADMIN");
  const facilitators = filtered.filter((u) => u.role === "FACILITATOR");
  const customers = filtered.filter((u) => u.role === "CUSTOMER");

  const sections = [
    { title: "Admins", users: admins, icon: Shield, color: "text-purple-600" },
    { title: "Facilitators", users: facilitators, icon: UserCheck, color: "text-blue-600" },
    { title: "Customers", users: customers, icon: Users, color: "text-slate-500" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold font-display text-slate-900">User Management</h1>
        <p className="text-slate-500 mt-1">Manage platform access, roles, and facilitator assignments.</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Users", count: users?.length ?? 0, color: "bg-slate-50 border-slate-200", text: "text-slate-700" },
          { label: "Facilitators", count: users?.filter(u => u.role === "FACILITATOR").length ?? 0, color: "bg-blue-50 border-blue-200", text: "text-blue-700" },
          { label: "Customers", count: users?.filter(u => u.role === "CUSTOMER").length ?? 0, color: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
        ].map((s) => (
          <Card key={s.label} className={`p-4 ${s.color} border text-center`}>
            <p className={`text-2xl font-bold ${s.text}`}>{s.count}</p>
            <p className="text-sm text-slate-500 mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search users by name or email..."
          className="pl-9 bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* User Sections */}
      {isLoading ? (
        <Card className="p-8 text-center text-slate-500">Loading users...</Card>
      ) : (
        sections.map(({ title, users: sectionUsers, icon: Icon, color }) =>
          sectionUsers.length === 0 ? null : (
            <div key={title}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-5 h-5 ${color}`} />
                <h2 className="text-base font-bold text-slate-700">{title}</h2>
                <span className="text-xs text-slate-400 font-medium">({sectionUsers.length})</span>
              </div>
              <Card className="bg-white border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
                      <tr>
                        <th className="px-6 py-3">User</th>
                        <th className="px-6 py-3 hidden sm:table-cell">Email</th>
                        <th className="px-6 py-3 hidden md:table-cell">Joined</th>
                        {title === "Facilitators" && (
                          <th className="px-6 py-3 text-center hidden lg:table-cell">Pipelines Assigned</th>
                        )}
                        <th className="px-6 py-3 text-right">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sectionUsers.map((u) => {
                        const roleConf = ROLE_CONFIG[u.role] || ROLE_CONFIG["CUSTOMER"];
                        const pipelineCount = facilitatorWorkloadMap.get(u.id);
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border border-slate-200 shadow-sm shrink-0">
                                  <AvatarImage src={u.avatarUrl || ""} />
                                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-semibold">
                                    {getInitials(u.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-slate-900">{u.name}</p>
                                  <p className="text-xs text-slate-400 sm:hidden">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 hidden sm:table-cell text-slate-600">{u.email}</td>
                            <td className="px-6 py-4 hidden md:table-cell text-slate-500">
                              {format(new Date(u.createdAt), "MMM d, yyyy")}
                            </td>
                            {title === "Facilitators" && (
                              <td className="px-6 py-4 hidden lg:table-cell text-center">
                                {pipelineCount !== undefined ? (
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                    pipelineCount > 5 ? "bg-red-100 text-red-700" :
                                    pipelineCount > 2 ? "bg-orange-100 text-orange-700" :
                                    "bg-blue-100 text-blue-700"
                                  }`}>
                                    {pipelineCount}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-xs">0</span>
                                )}
                              </td>
                            )}
                            <td className="px-6 py-4">
                              <div className="flex justify-end items-center gap-3">
                                {loadingId === u.id && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                                {u.role === "ADMIN" ? (
                                  <Badge className={`${roleConf.color} border font-medium`}>
                                    <Shield className="w-3 h-3 mr-1" />
                                    Admin
                                  </Badge>
                                ) : (
                                  <Select
                                    value={u.role}
                                    onValueChange={(val) => handleRoleChange(u.id, val)}
                                    disabled={loadingId === u.id}
                                  >
                                    <SelectTrigger className="w-[150px] h-9 bg-white">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="CUSTOMER">Customer</SelectItem>
                                      <SelectItem value="FACILITATOR">Facilitator</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )
        )
      )}
    </div>
  );
}
