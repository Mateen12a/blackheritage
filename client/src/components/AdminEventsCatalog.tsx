import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Star, ExternalLink, Calendar, Users, Eye, EyeOff, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export function AdminEventsCatalog() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: events, isLoading } = useQuery<any[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const res = await fetch("/api/events?limit=200", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load events");
      return res.json();
    },
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, isFeatured }: { id: string; isFeatured: boolean }) => {
      const res = await fetch(`/api/admin/events/${id}/featured`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isFeatured: !isFeatured }),
      });
      if (!res.ok) throw new Error("Failed to toggle featured status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Featured status updated" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Action failed", description: err.message });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/events/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event status updated" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Action failed", description: err.message });
    },
  });

  const filtered = (events || []).filter((e) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (e.title || "").toLowerCase().includes(term) ||
      (e.organizerName || "").toLowerCase().includes(term) ||
      (e.location || "").toLowerCase().includes(term)
    );
  });

  return (
    <Card className="border-hairline bg-surface">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base text-ink flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gold" />
              Platform Events Catalog
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Audit, feature, or moderate listings across the platform.
            </CardDescription>
          </div>
          <Link href="/admin/events/new">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-gold-soft text-xs h-8">
              Create Platform Event
            </Button>
          </Link>
        </div>

        <div className="pt-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-ink" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by event title, host, or location..."
              className="h-9 pl-9 text-xs bg-surface-2 border-hairline text-ink"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="py-16 text-center text-muted-ink">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gold mb-2" />
            Loading platform events…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-ink text-xs">
            No events match your search.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left text-xs text-ink">
              <thead className="border-b border-hairline bg-surface-2 text-muted-ink uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-6">Event</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Host / Organizer</th>
                  <th className="py-3 px-4">Featured</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filtered.map((e) => {
                  const isPublished = e.status === "published";
                  const isFeatured = Boolean(e.isFeatured);

                  return (
                    <tr key={e.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-3 px-6">
                        <Link href={`/events/${e.slug || e.id}`}>
                          <span className="font-semibold text-ink hover:text-gold transition-colors block cursor-pointer">
                            {e.title}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-muted-ink text-[11px] whitespace-nowrap">
                        {e.date ? format(new Date(e.date), "dd MMM yyyy") : "-"}
                      </td>
                      <td className="py-3 px-4 text-muted-ink truncate max-w-[140px]">
                        {e.location || "Lagos, NG"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-ink">{e.organizerName || "Organizer"}</span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => toggleFeaturedMutation.mutate({ id: e.id, isFeatured })}
                          disabled={toggleFeaturedMutation.isPending}
                          className={`p-1.5 rounded-md transition-colors ${
                            isFeatured
                              ? "text-gold bg-gold/15 border border-gold/30 hover:bg-gold/20"
                              : "text-muted-ink hover:text-ink hover:bg-surface-2 border border-hairline"
                          }`}
                          title={isFeatured ? "Featured (click to unfeature)" : "Not featured (click to feature)"}
                        >
                          <Star className={`w-3.5 h-3.5 ${isFeatured ? "fill-gold" : ""}`} />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                            isPublished
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-surface-2 text-muted-ink border-hairline"
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/events/${e.id}`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-hairline text-ink hover:text-gold px-2.5">
                              Manage
                            </Button>
                          </Link>
                          {isPublished ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateStatusMutation.mutate({ id: e.id, status: "draft" })}
                              className="h-7 text-xs text-muted-ink hover:text-amber-400 px-2"
                              title="Unpublish event"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateStatusMutation.mutate({ id: e.id, status: "published" })}
                              className="h-7 text-xs text-muted-ink hover:text-emerald-400 px-2"
                              title="Publish event"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          )}
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
