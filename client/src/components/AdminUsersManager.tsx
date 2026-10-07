import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Users, Shield, BadgeCheck, Check, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export function AdminUsersManager() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users", search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);
      const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load users");
      return res.json();
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User role updated successfully" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Role update failed", description: err.message });
    },
  });

  return (
    <Card className="border-hairline bg-surface">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base text-ink flex items-center gap-2">
              <Users className="w-4 h-4 text-gold" />
              System Users & Role Governance
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Inspect user accounts across the platform and manage administrative access privileges.
            </CardDescription>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-ink" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, username, or display name..."
              className="h-9 pl-9 text-xs bg-surface-2 border-hairline text-ink"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {["all", "admin", "organizer", "vendor", "attendee"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`h-9 px-3 rounded-md text-xs font-medium capitalize transition-colors ${
                  roleFilter === r
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-surface-2 text-muted-ink hover:text-ink border border-hairline"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="py-16 text-center text-muted-ink">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gold mb-2" />
            Loading user accounts…
          </div>
        ) : !users || users.length === 0 ? (
          <div className="py-12 text-center text-muted-ink text-xs">
            No user accounts match your search.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left text-xs text-ink">
              <thead className="border-b border-hairline bg-surface-2 text-muted-ink uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-6">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-6 text-right">Assign Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {users.map((u) => {
                  const isVerified = Boolean(u.isVerified);
                  const isUserAdmin = u.role === "admin";

                  return (
                    <tr key={u.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-3 px-6">
                        <div className="font-semibold text-ink">{u.displayName || u.username}</div>
                        <div className="text-[11px] text-muted-ink font-mono">@{u.username}</div>
                      </td>
                      <td className="py-3 px-4 text-muted-ink font-mono text-[11px]">
                        {u.email}
                      </td>
                      <td className="py-3 px-4 text-muted-ink text-[11px] whitespace-nowrap">
                        {u.createdAt ? format(new Date(u.createdAt), "dd MMM yyyy") : "-"}
                      </td>
                      <td className="py-3 px-4">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
                            <BadgeCheck className="w-3 h-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-ink">Unverified</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                            isUserAdmin
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                              : u.role === "organizer"
                              ? "bg-gold/10 text-gold border-gold/20"
                              : u.role === "vendor"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-surface-2 text-muted-ink border-hairline"
                          }`}
                        >
                          {isUserAdmin && <Shield className="w-2.5 h-2.5 mr-0.5" />}
                          {u.role || "attendee"}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right">
                        <div className="inline-block w-32">
                          <Select
                            value={u.role || "attendee"}
                            onValueChange={(newRole) => updateRoleMutation.mutate({ id: u.id, role: newRole })}
                            disabled={updateRoleMutation.isPending}
                          >
                            <SelectTrigger className="h-7 text-xs bg-surface-2 border-hairline text-ink">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-surface border-hairline text-ink">
                              <SelectItem value="attendee">Attendee</SelectItem>
                              <SelectItem value="organizer">Organizer</SelectItem>
                              <SelectItem value="vendor">Vendor</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
