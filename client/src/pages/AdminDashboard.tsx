import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useVendors } from "@/hooks/use-vendors";
import { useManagedEvents } from "@/hooks/use-managed-events";
import { useOrganizerProfile } from "@/hooks/use-organizer";
import { OrganizerBrandPanel } from "@/components/OrganizerBrandPanel";
import { SetupChecklist } from "@/components/SetupChecklist";
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
import { Link, useLocation } from "wouter";
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
} from "lucide-react";



export default function AdminDashboard() {
  const { user } = useAuth();
  const [location] = useLocation();
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
    // Admins get platform totals; organizers get the same shape scoped to
    // their own events, so the panel is never a dead end for either role.
    enabled: !!user,
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
    refetch: refetchLeads,
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

  const isDashboard = location === "/admin";
  const isEvents = location === "/admin/events";
  const isVendors = location === "/admin/vendors";

  const pageTitle = isDashboard
    ? isAdmin
      ? "Platform Overview"
      : "Organizer Dashboard"
    : isEvents
      ? "Events"
      : isVendors
        ? "Vendor Directory"
        : "Dashboard";

  const { data: orgProfile } = useOrganizerProfile();
  const [activeTab, setActiveTab] = useState(() => {
    if (isVendors) return "vendors";
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "events";
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pt-2">
        {eventsLoading ? (
          <HeaderSkeleton bare />
        ) : (
          <Reveal>
            <div>
              <p className="eyebrow">
                {isAdmin ? "Admin" : "Organizer"} portal
              </p>
              <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
                {pageTitle}
              </h1>
              <div className="mt-3 h-0.5 w-16 bg-gold" aria-hidden="true" />
              <p className="mt-3 text-muted-ink text-sm">
                {isDashboard &&
                  (isAdmin
                    ? "Everything on the platform, counted"
                    : "Your events, sales, and ticketing in one place")}
                {isEvents &&
                  `${events?.length || 0} event${events?.length === 1 ? "" : "s"} total`}
                {isVendors &&
                  `${vendors?.length || 0} vendor${vendors?.length === 1 ? "" : "s"} across Lagos`}
              </p>
            </div>
          </Reveal>
        )}

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {orgProfile?.slug && (
            <a
              href={`/o/${orgProfile.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="outline"
                className="press border-hairline text-ink hover:text-gold text-xs h-10 px-3.5"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                View Public Hub
              </Button>
            </a>
          )}
          <Link href="/admin/events/new">
            <Button className="press w-full sm:w-auto bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md">
              <Plus className="w-4 h-4 mr-2" /> Create Event
            </Button>
          </Link>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-surface-2 border border-hairline max-w-full overflow-x-auto no-scrollbar">
          <TabsTrigger value="events">Events & Overview</TabsTrigger>
          <TabsTrigger value="brand">Brand & Custom Link</TabsTrigger>
          {(isAdmin || isVendors) && <TabsTrigger value="vendors">Vendor Directory</TabsTrigger>}
          {isAdmin && (
            <TabsTrigger value="leads" className="flex items-center gap-1.5">
              <span>Organizer Leads</span>
              {leads && leads.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-gold/20 text-gold text-[10px] font-bold">
                  {leads.length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="events" className="space-y-6">
          {/* Onboarding progress until everything is done */}
          {!isAdmin && <SetupChecklist />}

          {/* Stats Grid: admin sees platform stats, organizer sees their own */}
          <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {statsLoading ? (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="border border-hairline rounded-md bg-surface p-4 md:p-5"
                  >
                    <StatSkeletonsStat />
                  </div>
                ))}
              </>
            ) : statsError ? (
              <div className="col-span-2 md:col-span-4">
                <LoadError
                  compact
                  title={isAdmin ? "Couldn't load platform stats" : "Couldn't load your stats"}
                  message="The rest of the dashboard still works."
                  onRetry={() => refetchStats()}
                />
              </div>
            ) : isAdmin ? (
              <>
                <DashStat
                  icon={Calendar}
                  label="Total Events"
                  value={stats?.totalEvents || 0}
                />
                <DashStat
                  icon={Ticket}
                  label="Tickets Sold"
                  value={stats?.totalTicketsSold || 0}
                />
                <DashStat
                  icon={DollarSign}
                  label="Total Revenue"
                  value={`₦${((stats?.totalRevenue || 0) / 100).toLocaleString()}`}
                />
                <DashStat
                  icon={Store}
                  label="Vendors"
                  value={vendors?.length || 0}
                />
              </>
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
                    {isAdmin ? "All Events" : "My Events"}
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
                          <Ticket className="w-10 h-10 text-muted-ink/20 mx-auto mb-3" />
                          <p className="font-display text-lg font-bold text-ink mb-1">
                            No events yet
                          </p>
                          <p className="text-muted-ink text-sm mb-5">
                            Create your first event to start selling tickets.
                          </p>
                          <Link href="/admin/events/new">
                            <Button
                              size="sm"
                              className="press bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md"
                            >
                              <Plus className="w-4 h-4 mr-2" /> Create Event
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    )}
                    {events?.map((event: any) => {
                      const expired = isPast(new Date(event.date));
                      const sales = eventSales(event);
                      return (
                        <tr
                          key={event.id}
                          className="hover:bg-surface-2/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-md overflow-hidden bg-surface-2 shrink-0 hidden sm:block">
                                <img
                                  src={event.imageUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-display font-bold text-ink text-sm">
                                    {event.title}
                                  </span>
                                  {expired && (
                                    <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold uppercase tracking-wider">
                                      Expired
                                    </span>
                                  )}
                                </div>
                                <span className="flex items-center gap-1 text-xs text-muted-ink mt-0.5">
                                  <MapPin className="w-3 h-3" />
                                  {event.location}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-ink hidden sm:table-cell">
                            {format(new Date(event.date), "MMM dd, yyyy")}
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
                            <span className="text-sm font-medium text-ink">
                              {sales.tickets.toLocaleString()}
                            </span>
                            <span className="block text-xs text-muted-ink">
                              ₦{(sales.revenue / 100).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                            <Link href={`/admin/events/${event.id}/bookings`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-hairline text-muted-ink text-xs hover:text-gold hover:border-gold/40 hover:bg-gold/5"
                              >
                                <Users className="w-3 h-3 mr-1" /> Bookings
                              </Button>
                            </Link>
                            <Link href={`/admin/events/${event.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-hairline text-muted-ink text-xs hover:text-gold hover:border-gold/40 hover:bg-gold/5"
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
          </div>
        </TabsContent>

        <TabsContent value="brand">
          <OrganizerBrandPanel />
        </TabsContent>

        {(isAdmin || isVendors) && (
          <TabsContent value="vendors">
            {vendorsError ? (
              <LoadError
                title="Couldn't load the vendor directory"
                message="Check your connection and try again."
                onRetry={() => refetchVendors()}
              />
            ) : vendorsLoading ? (
              <TableSkeleton rows={4} />
            ) : (
              <Reveal>
                <div className="border border-hairline rounded-md bg-surface overflow-hidden">
                  <div className="flex items-center justify-between p-5 md:p-6 border-b border-hairline">
                    <div>
                      <h2 className="font-display text-xl font-bold text-ink">
                        Vendor Directory
                      </h2>
                      <p className="mt-1 text-sm text-muted-ink">
                        All vendors listed on the platform
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[500px]">
                      <thead>
                        <tr className="border-b border-hairline">
                          <th className="px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em]">
                            Business
                          </th>
                          <th className="px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em]">
                            Category
                          </th>
                          <th className="px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em] hidden sm:table-cell">
                            City
                          </th>
                          <th className="px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em]">
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
                                No vendors yet
                              </p>
                            </td>
                          </tr>
                        )}
                        {vendors?.map((vendor: any) => (
                          <tr
                            key={vendor.id}
                            className="hover:bg-surface-2/50 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <Link href={`/vendors/${vendor.id}`}>
                                <span className="font-display font-bold text-ink text-sm hover:text-gold transition-colors cursor-pointer">
                                  {vendor.businessName}
                                </span>
                              </Link>
                            </td>
                            <td className="px-6 py-4">
                              <span className="eyebrow">{vendor.category}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-ink hidden sm:table-cell">
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
            )}
          </TabsContent>
        )}

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
                      When Nigerian event promoters visit <Link href="/organizers" className="text-gold underline">blackhevents.com/organizers</Link> and download the Free Zero-Gate-Fraud Playbook, their contact details and event size will appear here instantly.
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
      </Tabs>
    </div>
  );
}

/**
 * Tickets sold and gross revenue for one event, read from its ticket tiers.
 * `ticketTypes` arrives as a JSON string from the API, so parse defensively
 * and treat anything unparseable as no sales rather than crashing the table.
 */
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
    <div className="border border-hairline rounded-md bg-surface p-4 md:p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gold" aria-hidden="true" />
        <span className="text-xs text-muted-ink">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
