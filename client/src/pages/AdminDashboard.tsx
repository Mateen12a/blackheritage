import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useVendors } from "@/hooks/use-vendors";
import { useManagedEvents } from "@/hooks/use-managed-events";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { format, isPast } from "date-fns";
import {
  Loader2,
  Calendar,
  Users,
  DollarSign,
  Plus,
  Download,
  Ticket,
  Store,
  TrendingUp,
  MapPin,
  Eye,
} from "lucide-react";



export default function AdminDashboard() {
  const { user } = useAuth();
  const [location] = useLocation();
  const isAdmin = user?.role === "admin";

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: events, isLoading: eventsLoading } = useManagedEvents();

  const { data: vendors, isLoading: vendorsLoading } = useVendors();

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

  if (statsLoading || eventsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

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

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 pt-2">
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
                  ? "Platform-wide stats at a glance"
                  : "Your events and ticketing overview")}
              {isEvents &&
                `${events?.length || 0} event${events?.length === 1 ? "" : "s"} total`}
              {isVendors &&
                `${vendors?.length || 0} vendor${vendors?.length === 1 ? "" : "s"} across Lagos`}
            </p>
          </div>
        </Reveal>

        <Link href="/admin/events/new">
          <Button className="press w-full sm:w-auto bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md">
            <Plus className="w-4 h-4 mr-2" /> Create Event
          </Button>
        </Link>
      </div>

      {/* Stats Grid — admin sees platform stats, organizer sees their own */}
      {(isDashboard || isEvents) && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {isAdmin && stats ? (
              <>
                <DashStat
                  icon={Calendar}
                  label="Total Events"
                  value={stats.totalEvents || 0}
                />
                <DashStat
                  icon={Ticket}
                  label="Tickets Sold"
                  value={stats.totalTicketsSold || 0}
                />
                <DashStat
                  icon={DollarSign}
                  label="Total Revenue"
                  value={`₦${((stats.totalRevenue || 0) / 100).toLocaleString()}`}
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
                  value={events?.length || 0}
                />
                <DashStat
                  icon={Eye}
                  label="Published"
                  value={
                    events?.filter((e: any) => e.status === "published")
                      .length || 0
                  }
                />
                <DashStat
                  icon={TrendingUp}
                  label="Featured"
                  value={
                    events?.filter((e: any) => e.isFeatured).length || 0
                  }
                />
                <DashStat
                  icon={Store}
                  label="Vendors"
                  value={vendors?.length || 0}
                />
              </>
            )}
          </div>

          {/* Events Table */}
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
                      <th className="px-6 py-3.5 text-[11px] font-bold text-muted-ink uppercase tracking-[0.18em] text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {events?.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center">
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
        </>
      )}

      {/* Vendors tab */}
      {isVendors && (
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
                        {vendor.city || vendor.serviceArea || "—"}
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
