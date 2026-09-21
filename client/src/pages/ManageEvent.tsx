import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api, buildUrl } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Calendar, MapPin, Users, Package, Briefcase, FileText, Download, CheckCircle, Clock, Trash2, Edit, ChevronLeft, Tag, UserPlus, MailPlus, Undo2, Activity, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoute, Link, useLocation } from "wouter";
import { format, isPast } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookingLinkPanel } from "@/components/BookingLinkPanel";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  usePromos, useCreatePromo, useDeletePromo, useIssueManualTickets,
  useRefundBooking, useLiveStats,
} from "@/hooks/use-organizer";

/**
 * Waitlist signups for this event, with CSV export for outreach. Query is
 * enabled only when the tab can render, i.e. waitlist is on.
 */
function WaitlistPanel({ eventId }: { eventId: string }) {
  const entries = useQuery<any[]>({
    queryKey: ["/api/events", eventId, "waitlist"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/waitlist`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load the waitlist");
      return res.json();
    },
  });

  return (
    <Card className="bg-surface border-hairline">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-ink">Waitlist</CardTitle>
          <CardDescription>
            People who want in if a spot opens. Sort by join date, email from the top.
          </CardDescription>
        </div>
        <a href={`/api/events/${eventId}/waitlist.csv`} download>
          <Button variant="outline" size="sm" className="border-hairline press">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </a>
      </CardHeader>
      <CardContent className="p-0">
        {entries.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-gold" />
          </div>
        ) : !entries.data || entries.data.length === 0 ? (
          <p className="text-sm text-muted-ink px-6 py-8">
            Nobody has joined yet. The list fills from the event page once a tier sells out.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-hairline bg-surface-2">
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tier</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody>
                {entries.data.map((e: any) => (
                  <tr key={e.id} className="border-b border-hairline/50">
                    <td className="px-6 py-3 text-sm text-ink">{e.name}</td>
                    <td className="px-6 py-3 text-sm text-muted-ink">{e.email}</td>
                    <td className="px-6 py-3 text-sm text-muted-ink">{e.tierName || "Any"}</td>
                    <td className="px-6 py-3 text-sm text-muted-ink">
                      {format(new Date(e.createdAt), "d MMM yyyy, h:mm a")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ManageEvent() {
  const [, params] = useRoute("/admin/events/:id");
  const id = params?.id;
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: event, isLoading: eventLoading } = useQuery<any>({
    queryKey: [buildUrl(api.events.get.path, { id: id as string })],
    enabled: !!id,
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery<any[]>({
    queryKey: [buildUrl(api.bookings.listByEvent.path, { id: id as string })],
    enabled: !!id,
    // Live gate counts and momentum rely on fresh bookings while the
    // organizer keeps the dashboard open on event day.
    refetchInterval: 20000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(buildUrl(api.events.update.path, { id: id as string }), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.events.get.path, { id: id as string })] });
      toast({ title: "Status updated successfully" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildUrl(api.events.update.path, { id: id as string }), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete event");
    },
    onSuccess: () => {
      toast({ title: "Event deleted successfully" });
      setLocation("/admin");
    },
  });

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + Object.keys(data[0]).join(",") + "\n"
      + data.map(row => Object.values(row).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const verifyMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await fetch(`/api/bookings/${bookingId}/verify`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to verify ticket");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.bookings.listByEvent.path, { id: id as string })] });
      toast({ title: "Ticket Verified", description: "Attendee checked in successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Verification Failed", description: err.message, variant: "destructive" });
    }
  });

  if (eventLoading || bookingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="eyebrow">Off the list</p>
        <h1 className="mt-3 font-display text-2xl font-bold text-ink">Event not found</h1>
        <Link href="/admin">
          <Button variant="outline" className="mt-5 border-hairline text-ink hover:text-gold">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const isExpired = isPast(new Date(event.date));

  return (
    <div className="pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="w-fit border-hairline text-muted-ink hover:text-gold hover:bg-surface-2 transition-colors">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-ink leading-tight break-words tracking-tight">{event.title}</h1>
              {isExpired && (
                <span className="shrink-0 px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 text-[10px] font-bold uppercase tracking-wider">
                  Expired
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {event.location}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {format(new Date(event.date), "PPP")}</span>
            {event.organizerName && <span className="italic text-xs opacity-60">Published by {event.organizerName}</span>}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button 
            variant="outline" 
            className="flex-1 md:flex-none border-hairline h-10 px-4"
            onClick={() => {/* Mock edit */ toast({ title: "Edit coming soon" })}}
          >
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button 
            variant={event.status === 'published' ? 'outline' : 'default'}
            className={cn(
              "flex-1 md:flex-none h-10 px-4",
              event.status === 'published' ? 'border-gold/40 text-gold hover:bg-gold/10' : 'bg-primary text-primary-foreground'
            )}
            onClick={() => updateStatusMutation.mutate(event.status === 'published' ? 'unpublished' : 'published')}
            disabled={updateStatusMutation.isPending}
          >
            {event.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
          <Button 
            variant="destructive" 
            className="h-10 px-3"
            onClick={() => {
              if (confirm("Are you sure you want to delete this event?")) {
                deleteEventMutation.mutate();
              }
            }}
            disabled={deleteEventMutation.isPending}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="attendees" className="space-y-6">
        <TabsList className="bg-surface border border-hairline max-w-full overflow-x-auto no-scrollbar">
          <TabsTrigger value="attendees">Ticket Buyers</TabsTrigger>
          <TabsTrigger value="tools">Organizer Tools</TabsTrigger>
          <TabsTrigger value="link">Booking Link</TabsTrigger>
          <TabsTrigger value="sponsors">Sponsors & Vendors</TabsTrigger>
          <TabsTrigger value="settings">Event Settings</TabsTrigger>
          {(event as any).waitlistEnabled === true && (
            <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="attendees">
          {(() => {
            // Momentum, not just state: what changed in the last 24 hours is
            // what pulls an organizer back tomorrow.
            const paid = (bookings || []).filter((b: any) => b.status === "paid");
            const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
            const soldToday = paid
              .filter((b: any) => b.paidAt ? new Date(b.paidAt).getTime() >= dayAgo : false)
              .reduce((acc: number, b: any) => acc + Number(b.quantity || 1), 0);
            const going = paid.reduce((acc: number, b: any) => acc + Number(b.quantity || 1), 0);
            let capacity = Number(event.capacity || 0);
            try {
              const types = JSON.parse(event.ticketTypes || "[]");
              if (types.length > 0) capacity = types.reduce((a: number, t: any) => a + Number(t.capacity || 0), 0);
            } catch { /* fall back to the flat capacity */ }
            const pct = capacity > 0 ? Math.round((going / capacity) * 100) : 0;
            if (paid.length === 0) return null;
            return (
              <div className="rounded-md border border-hairline bg-surface p-5 mb-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-muted-ink">
                    <span className="font-display text-xl font-bold text-ink">{going}</span> going
                    {pct > 0 && <span className="text-muted-ink"> &middot; {pct}% full</span>}
                  </p>
                  <p className={"text-sm " + (soldToday > 0 ? "text-gold font-medium" : "text-muted-ink")}>
                    {soldToday > 0 ? soldToday + " sold in the last 24 hours" : "No sales in the last 24 hours"}
                  </p>
                </div>
                {capacity > 0 && (
                  <div className="mt-3 h-1.5 rounded-full bg-surface-2 overflow-hidden" role="presentation">
                    <div
                      className="h-full rounded-full bg-gold transition-all duration-500"
                      style={{ width: Math.min(100, pct) + "%" }}
                    />
                  </div>
                )}
              </div>
            );
          })()}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {(() => {
              try {
                const types = JSON.parse(event.ticketTypes || '[]');
                if (types.length === 0) {
                  const sold = bookings?.reduce((acc, b) => acc + b.quantity, 0) || 0;
                  return (
                    <Card className="bg-surface border-hairline">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Regular Tickets</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-ink">{event.capacity - sold} / {event.capacity}</div>
                        <p className="text-xs text-muted-foreground mt-1">Remaining availability</p>
                      </CardContent>
                    </Card>
                  );
                }
                return types.map((type: any) => (
                  <Card key={type.name} className="bg-surface border-hairline">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase">{type.name} Tickets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-ink">
                        {type.capacity - (type.sold || 0)} / {type.capacity}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Remaining availability</p>
                    </CardContent>
                  </Card>
                ));
              } catch (e) {
                return null;
              }
            })()}
          </div>
          <Card className="bg-surface border-hairline">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-ink">Attendee List</CardTitle>
                <CardDescription>View all users who have purchased tickets</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-hairline"
                onClick={() => exportToCSV(bookings || [], `attendees-${event.id}.csv`)}
              >
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-hairline bg-surface-2">
                      <th className="px-6 py-4 text-xs font-medium text-muted-ink">Name/Email</th>
                      <th className="px-6 py-4 text-xs font-medium text-muted-ink">Tickets</th>
                      <th className="px-6 py-4 text-xs font-medium text-muted-ink">Type</th>
                      <th className="px-6 py-4 text-xs font-medium text-muted-ink">Amount</th>
                      <th className="px-6 py-4 text-xs font-medium text-muted-ink">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {bookings?.map((booking) => (
                      <tr key={booking.id} className="hover:bg-surface-2 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-ink">{booking.name || 'Guest'}</div>
                          <div className="text-xs text-muted-foreground">{booking.email || 'No email'}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-ink">{booking.quantity}</td>
                        <td className="px-6 py-4 text-xs text-gold font-medium">{booking.ticketType}</td>
                        <td className="px-6 py-4 text-sm text-ink">₦{(booking.totalAmount / 100).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          {booking.isVerified ? (
                            <span className="flex items-center gap-1.5 text-xs text-gold font-medium">
                              <CheckCircle className="w-3 h-3" /> Verified
                            </span>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 border-gold/40 text-gold text-[10px]"
                              onClick={() => verifyMutation.mutate(booking.id)}
                              disabled={verifyMutation.isPending}
                            >
                              Verify
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!bookings || bookings.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-ink">
                          No bookings yet. Share the event link. The first sale is the hardest.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools">
          <OrganizerTools event={event} bookings={bookings || []} />
        </TabsContent>

        <TabsContent value="link">
          <BookingLinkPanel event={event} />
        </TabsContent>

        <TabsContent value="sponsors">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-surface border-hairline">
              <CardHeader>
                <CardTitle className="text-ink">Business Applications</CardTitle>
                <CardDescription>Sponsors and Vendors interested in this event</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Briefcase className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground">No applications received yet.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="bg-surface border-hairline">
            <CardHeader>
              <CardTitle className="text-ink">Quick Settings</CardTitle>
              <CardDescription>Sponsor and vendor applications for this event.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-surface-2 rounded-md border border-hairline">
                <div>
                  <div className="font-medium text-ink">Sponsor Bookings</div>
                  <div className="text-sm text-muted-ink">Business sponsorship applications</div>
                </div>
                <Button variant="outline" className="border-gold/40 text-gold">Enabled</Button>
              </div>
              <div className="flex items-center justify-between p-4 bg-surface-2 rounded-md border border-hairline">
                <div>
                  <div className="font-medium text-ink">Vendor Bookings</div>
                  <div className="text-sm text-muted-ink">Vendor space applications</div>
                </div>
                <Button variant="outline" className="border-gold/40 text-gold">Enabled</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Selling preferences, themes, and branding live in the Organizer Tools and Booking Link tabs.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waitlist">
          <WaitlistPanel eventId={String(event.id)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

function OrganizerTools({ event, bookings }: { event: any; bookings: any[] }) {
  const eventId = String(event.id);
  const { toast } = useToast();
  const promos = usePromos(eventId);
  const createPromo = useCreatePromo(eventId);
  const deletePromo = useDeletePromo(eventId);
  const manualTickets = useIssueManualTickets(eventId);
  const refund = useRefundBooking(eventId);
  const stats = useLiveStats(eventId);

  // Promo form state
  const [promoCode, setPromoCode] = useState("");
  const [promoKind, setPromoKind] = useState<"percent" | "fixed">("percent");
  const [promoValue, setPromoValue] = useState("");
  const [promoMaxUses, setPromoMaxUses] = useState("");

  // Manual ticket form state
  const [mtName, setMtName] = useState("");
  const [mtEmail, setMtEmail] = useState("");
  const [mtQty, setMtQty] = useState(1);
  const [mtTier, setMtTier] = useState("Guest list");

  const tiers: any[] = (() => {
    try { return JSON.parse(event.ticketTypes || "[]"); } catch { return []; }
  })();

  const revenue = bookings
    .filter((b) => b.status === "paid")
    .reduce((acc, b) => acc + Number(b.totalAmount || 0), 0);
  const ticketsSold = bookings.reduce((acc, b) => acc + Number(b.quantity || 0), 0);

  const submitPromo = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(promoValue);
    if (!promoCode.trim() || !value || value <= 0) {
      toast({ title: "Add a code name and a value", variant: "destructive" });
      return;
    }
    createPromo.mutate({
      code: promoCode.trim().toUpperCase(),
      kind: promoKind,
      value: promoKind === "percent" ? Math.min(100, value) : value * 100, // naira to kobo
      maxUses: promoMaxUses ? Number(promoMaxUses) : null,
    });
    setPromoCode(""); setPromoValue(""); setPromoMaxUses("");
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mtName.trim() || !mtEmail.trim()) {
      toast({ title: "Add the recipient's name and email", variant: "destructive" });
      return;
    }
    manualTickets.mutate({
      name: mtName.trim(),
      email: mtEmail.trim(),
      quantity: mtQty,
      tierName: mtTier,
    });
    setMtName(""); setMtEmail(""); setMtQty(1);
  };

  return (
    <div className="space-y-6">
      {/* Live figures */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-surface border-hairline">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-ink uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-gold" aria-hidden="true" /> Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold text-gold">{naira(revenue)}</div>
            <p className="text-xs text-muted-ink mt-1">Paid bookings</p>
          </CardContent>
        </Card>
        <Card className="bg-surface border-hairline">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-ink uppercase tracking-wider">Tickets sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold text-ink">{ticketsSold}</div>
            <p className="text-xs text-muted-ink mt-1">Across all tiers</p>
          </CardContent>
        </Card>
        <Card className="bg-surface border-hairline">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-ink uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-gold" aria-hidden="true" /> Checked in
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold text-ink">
              {stats.data ? `${stats.data.checkedIn} / ${stats.data.expected}` : "0 / 0"}
            </div>
            <p className="text-xs text-muted-ink mt-1">
              {stats.data?.flagged
                ? `${stats.data.flagged} flagged at the gate`
                : "Gate activity, updates live"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-surface border-hairline">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-ink uppercase tracking-wider">Last check-in</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold text-ink">
              {stats.data?.lastCheckInAt
                ? format(new Date(stats.data.lastCheckInAt), "HH:mm")
                : "None"}
            </div>
            <p className="text-xs text-muted-ink mt-1">Latest entry scanned</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manual tickets */}
        <Card className="bg-surface border-hairline">
          <CardHeader>
            <CardTitle className="text-ink flex items-center gap-2 text-base">
              <MailPlus className="w-4 h-4 text-gold" aria-hidden="true" /> Issue Complimentary Tickets
            </CardTitle>
            <CardDescription>For VIPs, press, sponsors, or staff. No payment, no service fee.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitManual} className="space-y-3">
              <Input
                placeholder="Recipient name"
                value={mtName}
                onChange={(e) => setMtName(e.target.value)}
                className="h-11 bg-surface-2 border-hairline text-ink focus-visible:border-gold focus-visible:ring-0"
                required
              />
              <Input
                type="email"
                placeholder="Recipient email"
                value={mtEmail}
                onChange={(e) => setMtEmail(e.target.value)}
                className="h-11 bg-surface-2 border-hairline text-ink focus-visible:border-gold focus-visible:ring-0"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={mtTier}
                  onChange={(e) => setMtTier(e.target.value)}
                  className="h-11 bg-surface-2 border border-hairline rounded-md px-3 text-sm text-ink"
                  aria-label="Tier"
                >
                  <option value="Guest list">Guest list</option>
                  {tiers.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={mtQty}
                  onChange={(e) => setMtQty(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  className="h-11 bg-surface-2 border-hairline text-ink focus-visible:border-gold focus-visible:ring-0"
                  aria-label="Quantity"
                />
              </div>
              <Button
                type="submit"
                disabled={manualTickets.isPending}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-gold-soft font-medium press"
              >
                {manualTickets.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Issue Tickets"}
              </Button>
              <p className="text-xs text-muted-ink">Coded PDF tickets go straight to their inbox.</p>
            </form>
          </CardContent>
        </Card>

        {/* Promo codes */}
        <Card className="bg-surface border-hairline">
          <CardHeader>
            <CardTitle className="text-ink flex items-center gap-2 text-base">
              <Tag className="w-4 h-4 text-gold" aria-hidden="true" /> Promo Codes
            </CardTitle>
            <CardDescription>Discounts with usage caps and expiry. Performance tracked live.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={submitPromo} className="space-y-3">
              <Input
                placeholder="CODE NAME"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                className="h-11 bg-surface-2 border-hairline text-ink uppercase focus-visible:border-gold focus-visible:ring-0"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={promoKind}
                  onChange={(e) => setPromoKind(e.target.value as "percent" | "fixed")}
                  className="h-11 bg-surface-2 border border-hairline rounded-md px-3 text-sm text-ink"
                  aria-label="Discount type"
                >
                  <option value="percent">Percent off</option>
                  <option value="fixed">Naira off</option>
                </select>
                <Input
                  type="number"
                  min={1}
                  placeholder={promoKind === "percent" ? "15" : "2000"}
                  value={promoValue}
                  onChange={(e) => setPromoValue(e.target.value)}
                  className="h-11 bg-surface-2 border-hairline text-ink focus-visible:border-gold focus-visible:ring-0"
                  aria-label={promoKind === "percent" ? "Percent" : "Naira amount"}
                  required
                />
              </div>
              <Input
                type="number"
                min={1}
                placeholder="Usage limit (blank = unlimited)"
                value={promoMaxUses}
                onChange={(e) => setPromoMaxUses(e.target.value)}
                className="h-11 bg-surface-2 border-hairline text-ink focus-visible:border-gold focus-visible:ring-0"
              />
              <Button
                type="submit"
                disabled={createPromo.isPending}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-gold-soft font-medium press"
              >
                {createPromo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Code"}
              </Button>
            </form>

            <div className="space-y-2">
              {promos.isLoading ? (
                <p className="text-sm text-muted-ink py-2">Loading codes...</p>
              ) : promos.data && promos.data.length > 0 ? (
                promos.data.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-surface-2 border border-hairline rounded-md px-3 py-2.5"
                  >
                    <div>
                      <p className="font-mono font-bold text-sm text-ink">{p.code}</p>
                      <p className="text-xs text-muted-ink">
                        {p.kind === "percent" ? `${p.value}% off` : `${naira(p.value)} off`}
                        {" \u00b7 "}
                        {p.usedCount} used{p.maxUses ? ` of ${p.maxUses}` : ""}
                        {p.expiresAt ? ` \u00b7 expires ${format(new Date(p.expiresAt), "d MMM")}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-ink hover:text-destructive h-8 px-2"
                      aria-label={`Delete ${p.code}`}
                      onClick={() => deletePromo.mutate(p.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-ink py-2">No codes yet. Create your first one above.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exports and refunds */}
      <Card className="bg-surface border-hairline">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-ink">Attendee Export & Refunds</CardTitle>
            <CardDescription>
              CSV carries name, tier, ticket code, payment, and check-in status for event briefing.
            </CardDescription>
          </div>
          <a href={`/api/events/${eventId}/attendees.csv`} download>
            <Button variant="outline" size="sm" className="border-hairline press">
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
          </a>
        </CardHeader>
        <CardContent className="space-y-2">
          {bookings.filter((b) => b.status === "paid").length === 0 ? (
            <p className="text-sm text-muted-ink py-2">
              No paid bookings yet. Refunds appear here once sales start.
            </p>
          ) : (
            bookings
              .filter((b) => b.status === "paid" || b.status === "cancelled")
              .map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 bg-surface-2 border border-hairline rounded-md px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {b.name || "Guest"} <span className="text-muted-ink font-normal">\u00b7 {b.quantity}x {b.ticketType} \u00b7 {naira(b.totalAmount)}</span>
                    </p>
                    <p className="text-xs text-muted-ink">{b.email}</p>
                  </div>
                  {b.status === "cancelled" ? (
                    <span className="text-xs text-red-400 font-medium flex items-center gap-1.5">
                      <Undo2 className="w-3.5 h-3.5" /> Refunded
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-hairline text-muted-ink hover:text-destructive hover:border-destructive/40 press"
                      disabled={refund.isPending}
                      onClick={() => {
                        if (confirm(`Refund ${naira(b.totalAmount)} to ${b.name || "this customer"}? The ticket will be voided.`)) {
                          refund.mutate(b.id);
                        }
                      }}
                    >
                      <Undo2 className="w-3.5 h-3.5 mr-1.5" /> Refund
                    </Button>
                  )}
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
