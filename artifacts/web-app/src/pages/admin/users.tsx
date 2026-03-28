import { useUsers, useUpdateUserRole } from "@/hooks/use-users";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export default function AdminUsers() {
  const { data: users, isLoading } = useUsers();
  const updateRole = useUpdateUserRole();
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

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

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold font-display text-slate-900">User Management</h1>
        <p className="text-slate-500 mt-1">Manage platform access and roles.</p>
      </div>

      <Card className="bg-white border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading users...</td></tr>
              ) : users?.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-slate-200 shadow-sm">
                        <AvatarImage src={u.avatarUrl || ""} />
                        <AvatarFallback className="bg-primary/5 text-primary">{getInitials(u.name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-slate-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{u.email}</td>
                  <td className="px-6 py-4 text-slate-500">{format(new Date(u.createdAt), "MMM d, yyyy")}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end items-center gap-3">
                      {loadingId === u.id && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                      <Select value={u.role} onValueChange={(val) => handleRoleChange(u.id, val)} disabled={loadingId === u.id || u.role === 'ADMIN'}>
                        <SelectTrigger className="w-[140px] h-9 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CUSTOMER">Customer</SelectItem>
                          <SelectItem value="FACILITATOR">Facilitator</SelectItem>
                          <SelectItem value="ADMIN" disabled>Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
