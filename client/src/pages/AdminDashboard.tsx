import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, Users, DollarSign, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { format, isPast } from "date-fns";
import { useAuth } from "@/hooks/use-auth";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [location] = useLocation();
  
  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: [api.events.stats.path],
  });

  const { data: events, isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: [api.events.list.path],
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

  if (statsLoading || eventsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // Filter content based on sub-route if needed, but for now we'll just show dashboard
  const isDashboard = location === "/admin";
  const isEvents = location === "/admin/events";
  const isBookings = location === "/admin/bookings";
  const isSponsors = location === "/admin/sponsors";
  const isVendors = location === "/admin/vendors";

  return (
    <div className="pb-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-display font-bold text-white">
          {isDashboard ? "Dashboard" : 
           isEvents ? "Events Management" :
           isBookings ? "Bookings" :
           isSponsors ? "Sponsors" :
           isVendors ? "Vendors / Sellers" : "Admin"}
        </h1>
        <Link href="/admin/events/new">
          <Button className="bg-primary text-background hover:bg-white font-bold">
            <Plus className="w-4 h-4 mr-2" /> Create New Event
          </Button>
        </Link>
      </div>

      {(isDashboard || isEvents) && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <Card className="bg-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Total Events</CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stats?.totalEvents || 0}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Tickets Sold</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stats?.totalTicketsSold || 0}</div>
              </CardContent>
            </Card>
            <Card className="bg-card border-white/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">₦{(stats?.totalRevenue / 100 || 0).toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>

          {/* Events Table */}
          <Card className="bg-card border-white/5 overflow-hidden mb-12">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-display text-white">Recent Events</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/5">
                      <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">Event</th>
                      <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider hidden sm:table-cell">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {events?.map((event) => {
                      const expired = isPast(new Date(event.date));
                      return (
                        <tr key={event.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="font-bold text-white text-sm sm:text-base">{event.title}</div>
                              {expired && (
                                <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 text-[8px] font-bold uppercase">
                                  Expired
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">{event.location}</div>
                            {event.organizerName && <div className="text-[10px] italic text-muted-foreground/60">by {event.organizerName}</div>}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground hidden sm:table-cell">
                            {format(new Date(event.date), "MMM dd, yyyy")}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-bold uppercase tracking-wider ${
                              event.status === 'published' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                            }`}>
                              {event.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-1 sm:space-x-2 whitespace-nowrap">
                            <Link href={`/admin/events/${event.id}`}>
                              <Button variant="outline" size="sm" className="h-7 sm:h-8 border-white/10 text-[10px] sm:text-xs px-2 sm:px-3">
                                Manage
                              </Button>
                            </Link>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 sm:h-8 border-white/10 text-[10px] sm:text-xs px-2 sm:px-3 hidden xs:inline-flex"
                              onClick={() => exportToCSV([event], `event-${event.id}.csv`)}
                            >
                              <Download className="w-3 h-3 sm:mr-1" /> <span className="hidden sm:inline">Export</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {(isBookings || isSponsors || isVendors) && (
        <Card className="bg-card border-white/5 py-20">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <DollarSign className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No data yet</h3>
            <p className="text-muted-foreground max-w-md">
              There are currently no records to display for this section. New applications and bookings will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
