import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useVendors } from "@/hooks/use-vendors";
import { useManagedEvents } from "@/hooks/use-managed-events";
import { useOrganizerProfile } from "@/hooks/use-organizer";
import { OrganizerBrandPanel } from "@/components/OrganizerBrandPanel";
import { SetupChecklist } from "@/components/SetupChecklist";
import { AdminVerificationsPanel } from "@/components/AdminVerificationsPanel";
import { AdminFinancialOverview } from "@/components/AdminFinancialOverview";
import { AdminTransactionsLedger } from "@/components/AdminTransactionsLedger";
import { AdminEventsCatalog } from "@/components/AdminEventsCatalog";
import { AdminUsersManager } from "@/components/AdminUsersManager";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatSkeletons,
  TableSkeleton,
  HeaderSkeleton,
  LoadError,
} from "@/components/AsyncStates";
import { Link, useLocation, useSearch } from "wouter";
import { format, isPast } from "date-fns";
import {
  Calendar,
  Users,
  DollarSign,
  Plus,
  Download,
  Ticket,
  Store,
  MapPin,
  Eye,
  ExternalLink,
  MessageCircle,
  Phone,
  Trophy,
  ShieldAlert,
  Landmark,
  Sliders,
  Shield,
  Palette,
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const isAdmin = user?.role === "admin";

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load stats");
      return res.json();
    },
    enabled: !!user && !isAdmin, // Admins use financial-overview telemetry
    retry: 1,
  });

  const {
    data: events,
    isLoading: eventsLoading,
    isError: eventsError,
    refetch: refetchEvents,
  } = useManagedEvents();

  const {
    data: vendors,
    isLoading: vendorsLoading,
    isError: vendorsError,
    refetch: refetchVendors,
  } = useVendors();

  const {
    data: leads,
    isLoading: leadsLoading,
  } = useQuery<any[]>({
    queryKey: ["/api/admin/leads"],
    queryFn: async () => {
      const res = await fetch("/api/admin/leads", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load leads");
      return res.json();
    },
    enabled: isAdmin,
  });

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const csvContent =
      "data:text/csv;charset=utf-8," +
      Object.keys(data[0]).join(",") +
      "\n" +
      data.map((row) => Object.values(row).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { data: orgProfile } = useOrganizerProfile();

  const getTabFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam) return tabParam;
    if (location === "/admin/brand") return "brand";
    if (location === "/admin/bookings") return isAdmin ? "transactions" : "events";
    if (location === "/admin/events") return isAdmin ? "events_catalog" : "events";
    if (location === "/admin/talent" || location === "/admin/vendors") return "talent";
    return isAdmin ? "financials" : "events";
  }, [location, isAdmin]);

  const [activeTab, setActiveTab] = useState(getTabFromUrl);

  // Sync activeTab whenever route location or search params (?tab=brand) update
  useEffect(() => {
    const nextTab = getTabFromUrl();
    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [location, search, getTabFromUrl, activeTab]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", val);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  };

  const pageTitle = isAdmin
    ? "Platform Administration"
    : "Organizer Dashboard";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8 pt-2">
        <Reveal>
          <div>
            <div className="flex items-center gap-2">
              <p className="eyebrow">
                {isAdmin ? "Platform Operations & Governance" : "Organizer portal"}
              </p>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Shield className="w-2.5 h-2.5" />
                  Superadmin
                </span>
              )}
            </div>
            <h1 className="mt-2 font-display text-2xl min-[360px]:text-3xl md:text-4xl font-bold text-ink tracking-tight">
              {pageTitle}
            </h1>
            <div className="mt-3 h-0.5 w-16 bg-gold" aria-hidden="true" />
            <p className="mt-3 text-muted-ink text-xs sm:text-sm">
              {isAdmin
                ? "Live financial operations, transaction audits, compliance review, and catalog governance."
                : "Your events, sales, and ticketing in one place."}
            </p>
          </div>
        </Reveal>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          {!isAdmin && (
            <>
              <Link href="/vendor-dashboard">
                <Button
                  variant="outline"
                  className="press border-hairline text-ink hover:text-gold text-xs h-9 sm:h-10 px-3 sm:px-3.5"
                >
                  <Store className="w-3.5 h-3.5 mr-1.5" />
                  Work as Talent
                </Button>
              </Link>
              <Link href="/challenges">
                <Button
                  variant="outline"
                  className="press border-gold/30 bg-gold/5 text-gold hover:bg-gold/15 text-xs h-9 sm:h-10 px-3 sm:px-3.5"
                >
                  <Trophy className="w-3.5 h-3.5 mr-1.5" />
                  Challenges
                </Button>
              </Link>
            </>
          )}

          {orgProfile?.slug && (
            <a
              href={`/o/${orgProfile.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="outline"
                className="press border-hairline text-ink hover:text-gold text-xs h-9 sm:h-10 px-3 sm:px-3.5"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Public Hub
              </Button>
            </a>
          )}

          <Link href="/admin/events/new">
            <Button className="press w-full sm:w-auto bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md h-9 sm:h-10 text-xs sm:text-sm">
              <Plus className="w-4 h-4 mr-1.5 sm:mr-2" />
              {isAdmin ? "Create Platform Event" : "Create Event"}
            </Button>
          </Link>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-surface-2 border border-hairline max-w-full overflow-x-auto no-scrollbar">
          {isAdmin ? (
            <>
              <TabsTrigger value="financials" className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                <span>Financials &amp; Commission</span>
              </TabsTrigger>
              <TabsTrigger value="transactions" className="flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5" />
                <span>Transactions Ledger</span>
              </TabsTrigger>
              <TabsTrigger value="verifications" className="flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" />
                <span>Compliance &amp; Payouts</span>
              </TabsTrigger>
              <TabsTrigger value="events_catalog" className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Events Catalog</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>User Governance</span>
              </TabsTrigger>
              <TabsTrigger value="brand" className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                <span>Brand &amp; Link</span>
              </TabsTrigger>
              <TabsTrigger value="leads" className="flex items-center gap-1.5">
                <span>Inbound Leads</span>
                {leads && leads.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-gold/20 text-gold text-[10px] font-bold">
                    {leads.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="talent">
                <span>Talent Directory</span>
              </TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="events">My Events &amp; Overview</TabsTrigger>
              <TabsTrigger value="brand">Brand &amp; Custom Link</TabsTrigger>
              <TabsTrigger value="talent" onClick={() => setLocation("/vendor-dashboard")}>
                Work as Talent
              </TabsTrigger>
              <TabsTrigger value="challenges" onClick={() => setLocation("/challenges")}>
                Creative Challenges
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ── Admin Tabs ── */}
        {isAdmin && (
          <>
            <TabsContent value="financials" className="space-y-6">
              <Reveal>
                <AdminFinancialOverview onNavigateToLedger={() => setActiveTab("verifications")} />
              </Reveal>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-6">
              <Reveal>
                <AdminTransactionsLedger />
              </Reveal>
            </TabsContent>

            <TabsContent value="verifications" className="space-y-6">
              <Reveal>
                <AdminVerificationsPanel />
              </Reveal>
            </TabsContent>

            <TabsContent value="events_catalog" className="space-y-6">
              <Reveal>
                <AdminEventsCatalog />
              </Reveal>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <Reveal>
                <AdminUsersManager />
              </Reveal>
            </TabsContent>

            <TabsContent value="talent" className="space-y-6">
              <Reveal>
                <div className="border border-hairline rounded-md bg-surface overflow-hidden">
                  <div className="flex items-center justify-between p-4 sm:p-5 md:p-6 border-b border-hairline">
                    <div>
                      <h2 className="font-display text-lg sm:text-xl font-bold text-ink">
                        Talent &amp; Vendors Directory
                      </h2>
                      <p className="mt-1 text-xs sm:text-sm text-muted-ink">
                        All creative talent and vendors listed on the platform
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[500px]">
                      <thead>
                        <tr className="border-b border-hairline">
                          <th className="px-5 sm:px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em]">
                            Creative Talent
                          </th>
                          <th className="px-5 sm:px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em]">
                            Category
                          </th>
                          <th className="px-5 sm:px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em] hidden sm:table-cell">
                            City
                          </th>
                          <th className="px-5 sm:px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em]">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {vendors?.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-16 text-center">
                              <Store className="w-10 h-10 text-muted-ink/20 mx-auto mb-3" />
                              <p className="font-display text-lg font-bold text-ink">
                                No talent listed yet
                              </p>
                            </td>
                          </tr>
                        )}
                        {vendors?.map((vendor: any) => (
                          <tr
                            key={vendor.id}
                            className="hover:bg-surface-2/50 transition-colors"
                          >
                            <td className="px-5 sm:px-6 py-3.5 sm:py-4">
                              <Link href={vendor.slug ? `/t/${vendor.slug}` : `/talent/${vendor.id}`}>
                                <span className="font-display font-bold text-ink text-sm hover:text-gold transition-colors cursor-pointer">
                                  {vendor.businessName}
                                </span>
                              </Link>
                            </td>
                            <td className="px-5 sm:px-6 py-3.5 sm:py-4">
                              <span className="eyebrow">{vendor.category}</span>
                            </td>
                            <td className="px-5 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm text-muted-ink hidden sm:table-cell">
                              {vendor.city || vendor.serviceArea || "Not listed"}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  vendor.status === "published"
                                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                    : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                                }`}
                              >
                                {vendor.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Reveal>
            </TabsContent>
          </>
        )}

        {/* ── Organizer Tabs ── */}
        {!isAdmin && (
          <>
            <TabsContent value="events" className="space-y-6">
              <SetupChecklist />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-12">
                {statsLoading ? (
                  <>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="border border-hairline rounded-md bg-surface p-3.5 sm:p-4 md:p-5"
                      >
                        <StatSkeletonsStat />
                      </div>
                    ))}
                  </>
                ) : statsError ? (
                  <div className="col-span-2 md:col-span-4">
                    <LoadError
                      compact
                      title="Couldn't load your stats"
                      message="The rest of the dashboard still works."
                      onRetry={() => refetchStats()}
                    />
                  </div>
                ) : (
                  <>
                    <DashStat
                      icon={Calendar}
                      label="My Events"
                      value={stats?.totalEvents || 0}
                    />
                    <DashStat
                      icon={Ticket}
                      label="Tickets Sold"
                      value={stats?.totalTicketsSold || 0}
                    />
                    <DashStat
                      icon={DollarSign}
                      label="Revenue"
                      value={`₦${((stats?.totalRevenue || 0) / 100).toLocaleString()}`}
                    />
                    <DashStat
                      icon={Eye}
                      label="Published"
                      value={
                        events?.filter((e: any) => e.status === "published")
                          .length || 0
                      }
                    />
                  </>
                )}
              </div>

              {/* Events Table */}
              {eventsError ? (
                <LoadError
                  title="Couldn't load your events"
                  message="Check your connection and try again."
                  onRetry={() => refetchEvents()}
                />
              ) : eventsLoading ? (
                <TableSkeleton rows={4} />
              ) : (
                <Reveal>
                  <div className="border border-hairline rounded-md bg-surface overflow-hidden mb-12">
                    <div className="flex items-center justify-between p-5 md:p-6 border-b border-hairline">
                      <div>
                        <h2 className="font-display text-xl font-bold text-ink">
                          My Events
                        </h2>
                        <p className="mt-1 text-sm text-muted-ink">
                          Manage tickets, bookings, and visibility
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-hairline text-ink hover:bg-surface-2 hover:text-gold"
                        onClick={() => exportToCSV(events || [], "events.csv")}
                      >
                        <Download className="w-4 h-4 mr-2" /> Export
                      </Button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[500px]">
                        <thead>
                          <tr className="border-b border-hairline">
                            <th className="px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em]">
                              Event
                            </th>
                            <th className="px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em] hidden sm:table-cell">
                              Date
                            </th>
                            <th className="px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em]">
                              Status
                            </th>
                            <th className="px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em] hidden sm:table-cell">
                              Sold
                            </th>
                            <th className="px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em] text-right">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {events?.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-16 text-center">
                                <Calendar className="w-10 h-10 text-muted-ink/20 mx-auto mb-3" />
                                <p className="font-display text-lg font-bold text-ink">
                                  No events created yet
                                </p>
                                <p className="text-sm text-muted-ink mt-1 max-w-sm mx-auto">
                                  Publish an event to start selling tickets and receiving payouts.
                                </p>
                                <Link href="/admin/events/new">
                                  <Button className="mt-6 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-xs">
                                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Event
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          )}
                          {events?.map((event: any) => {
                            const sales = eventSales(event);
                            return (
                              <tr
                                key={event.id}
                                className="hover:bg-surface-2/50 transition-colors"
                              >
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-4">
                                    {event.imageUrl ? (
                                      <img
                                        src={event.imageUrl}
                                        alt=""
                                        className="w-12 h-12 rounded object-cover border border-hairline bg-surface-2"
                                      />
                                    ) : (
                                      <div className="w-12 h-12 rounded bg-surface-2 border border-hairline flex items-center justify-center text-muted-ink">
                                        <Calendar className="w-5 h-5" />
                                      </div>
                                    )}
                                    <div>
                                      <Link href={`/admin/events/${event.id}`}>
                                        <span className="font-display font-bold text-ink hover:text-gold transition-colors text-base cursor-pointer">
                                          {event.title}
                                        </span>
                                      </Link>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-muted-ink flex items-center">
                                          <MapPin className="w-3 h-3 mr-1" />
                                          {event.location}
                                        </span>
                                        {event.isFeatured && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gold/10 text-gold border border-gold/20">
                                            Featured
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-xs sm:text-sm text-muted-ink hidden sm:table-cell">
                                  {event.date ? format(new Date(event.date), "MMM d, yyyy") : "-"}
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                      event.status === "published"
                                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                        : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                                    }`}
                                  >
                                    {event.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 hidden sm:table-cell">
                                  <div className="text-xs sm:text-sm font-bold text-ink">
                                    {sales.tickets} tickets
                                  </div>
                                  <div className="text-xs text-muted-ink">
                                    ₦{(sales.revenue / 100).toLocaleString()}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <Link href={`/admin/events/${event.id}`}>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="press border-hairline text-ink hover:text-gold text-xs h-8 px-3"
                                    >
                                      Manage
                                    </Button>
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Reveal>
              )}
            </TabsContent>
          </>
        )}

        {/* ── Inbound Leads (Both Admins & Lead Listeners) ── */}
        {isAdmin && (
          <TabsContent value="leads" className="space-y-6">
            <Reveal>
              <div className="border border-hairline rounded-md bg-surface overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 md:p-6 border-b border-hairline gap-4">
                  <div>
                    <h2 className="font-display text-xl font-bold text-ink">
                      Organizer Leads &amp; Playbook Inquiries
                    </h2>
                    <p className="text-xs text-muted-ink mt-1">
                      Promoters and festival directors who requested the 2026 Zero-Gate-Fraud Playbook.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {leads && leads.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportToCSV(leads, "organizer-leads.csv")}
                        className="press border-hairline text-ink hover:text-gold text-xs h-9"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
                      </Button>
                    )}
                  </div>
                </div>

                {leadsLoading ? (
                  <div className="p-5 md:p-6 space-y-4" role="status" aria-live="polite">
                    <span className="sr-only">Loading organizer leads</span>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4" aria-hidden="true">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-1/5" />
                        <Skeleton className="h-4 w-1/6" />
                        <Skeleton className="h-4 w-1/5 ml-auto" />
                      </div>
                    ))}
                  </div>
                ) : !leads || leads.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="font-display text-lg font-bold text-ink">No Leads Captured Yet</p>
                    <p className="text-xs text-muted-ink mt-1.5 max-w-md mx-auto leading-relaxed">
                      When Nigerian event promoters visit <Link href="/organizers" className="text-gold underline">blackhevents.com/organizers</Link> and download the Free Zero-Gate-Fraud Playbook, their contact details will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-hairline bg-surface-2 text-muted-ink text-[11px] font-semibold uppercase tracking-wider">
                          <th className="py-3 px-4">Organizer &amp; Brand</th>
                          <th className="py-3 px-4">WhatsApp Direct</th>
                          <th className="py-3 px-4 hidden md:table-cell">Email</th>
                          <th className="py-3 px-4 hidden sm:table-cell">City &amp; Crowd</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {leads.map((lead: any) => {
                          const rawPhone = String(lead.whatsapp || "").replace(/[^0-9]/g, "");
                          const intlPhone = rawPhone.startsWith("0") ? "234" + rawPhone.slice(1) : rawPhone;
                          const waText = encodeURIComponent(
                            `Hi ${lead.name}, saw you requested the Black Heritage Zero-Gate-Fraud Playbook for ${lead.brandName}! Are you planning an event soon?`
                          );
                          const waUrl = `https://wa.me/${intlPhone}?text=${waText}`;

                          return (
                            <tr key={lead._id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3.5 px-4">
                                <p className="font-bold text-ink text-sm">{lead.brandName}</p>
                                <p className="text-xs text-muted-ink mt-0.5">{lead.name}</p>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="font-mono text-gold font-medium">{lead.whatsapp}</span>
                              </td>
                              <td className="py-3.5 px-4 hidden md:table-cell text-muted-ink">
                                {lead.email}
                              </td>
                              <td className="py-3.5 px-4 hidden sm:table-cell">
                                <span className="text-ink font-medium">{lead.city}</span>
                                <span className="text-xs text-muted-ink block">{lead.estimatedAttendance} people</span>
                              </td>
                              <td className="py-3.5 px-4 text-muted-ink text-xs whitespace-nowrap">
                                {format(new Date(lead.createdAt), "MMM d, yyyy")}
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <a href={waUrl} target="_blank" rel="noreferrer">
                                  <Button
                                    size="sm"
                                    className="press h-8 px-3 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-black font-semibold text-xs border border-emerald-500/30"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5 mr-1" />
                                    Chat
                                  </Button>
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Reveal>
          </TabsContent>
        )}

        {/* ── Brand & Custom Link (Accessible to both Organizers & Admins) ── */}
        <TabsContent value="brand" className="space-y-6">
          <Reveal>
            <OrganizerBrandPanel />
          </Reveal>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function eventSales(event: any): { tickets: number; revenue: number } {
  let tiers: any[] = [];
  try {
    tiers =
      typeof event.ticketTypes === "string"
        ? JSON.parse(event.ticketTypes || "[]")
        : event.ticketTypes || [];
  } catch {
    tiers = [];
  }
  if (!Array.isArray(tiers)) return { tickets: 0, revenue: 0 };
  return tiers.reduce(
    (acc, tier) => ({
      tickets: acc.tickets + (Number(tier?.sold) || 0),
      revenue: acc.revenue + (Number(tier?.price) || 0) * (Number(tier?.sold) || 0),
    }),
    { tickets: 0, revenue: 0 },
  );
}

function StatSkeletonsStat() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-4 w-4 rounded-sm" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-7 w-14" />
    </div>
  );
}

function DashStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: number | string;
}) {
  return (
    <div className="border border-hairline rounded-md bg-surface p-3 sm:p-4 md:p-5">
      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold shrink-0" aria-hidden="true" />
        <span className="text-[11px] sm:text-xs text-muted-ink truncate">{label}</span>
      </div>
      <p className="font-display text-lg sm:text-xl md:text-2xl font-bold text-ink truncate">{value}</p>
    </div>
  );
}
