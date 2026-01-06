import { useQuery, useMutation } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Calendar, MapPin, Users, Package, Briefcase, FileText, Download, CheckCircle, Clock, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoute, Link, useLocation } from "wouter";
import { format, isPast } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
      <div className="flex flex-col items-center justify-center min-h-[400px] text-white">
        <p className="text-xl">Event not found.</p>
        <Link href="/admin">
          <Button className="mt-4">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const isExpired = isPast(new Date(event.date));

  return (
    <div className="pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white">← Back</Button>
            </Link>
            <h1 className="text-3xl font-display font-bold text-white">{event.title}</h1>
            {isExpired && (
              <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold uppercase">
                Expired
              </span>
            )}
          </div>
          <p className="text-muted-foreground">
            {event.location} • {format(new Date(event.date), "PPP")} 
            {event.organizerName && <span className="ml-2 italic text-xs">• Published by {event.organizerName}</span>}
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="border-white/10"
            onClick={() => {/* Mock edit */ toast({ title: "Edit coming soon" })}}
          >
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button 
            variant={event.status === 'published' ? 'outline' : 'default'}
            className={event.status === 'published' ? 'border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10' : 'bg-primary text-background'}
            onClick={() => updateStatusMutation.mutate(event.status === 'published' ? 'unpublished' : 'published')}
            disabled={updateStatusMutation.isPending}
          >
            {event.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
          <Button 
            variant="destructive" 
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
        <TabsList className="bg-card border border-white/5">
          <TabsTrigger value="attendees">Ticket Buyers</TabsTrigger>
          <TabsTrigger value="sponsors">Sponsors & Vendors</TabsTrigger>
          <TabsTrigger value="settings">Event Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="attendees">
          <Card className="bg-card border-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">Attendee List</CardTitle>
                <CardDescription>View all users who have purchased tickets</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-white/10"
                onClick={() => exportToCSV(bookings || [], `attendees-${event.id}.csv`)}
              >
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/5">
                      <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">Name/Email</th>
                      <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">Tickets</th>
                      <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">Type</th>
                      <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {bookings?.map((booking) => (
                      <tr key={booking.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-white">{booking.name || 'Guest'}</div>
                          <div className="text-xs text-muted-foreground">{booking.email || 'No email'}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-white">{booking.quantity}</td>
                        <td className="px-6 py-4 text-xs text-primary font-bold uppercase">{booking.ticketType}</td>
                        <td className="px-6 py-4 text-sm text-white">₦{(booking.totalAmount / 100).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          {booking.isVerified ? (
                            <span className="flex items-center gap-1.5 text-xs text-green-500 font-bold uppercase">
                              <CheckCircle className="w-3 h-3" /> Verified
                            </span>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 border-primary text-primary text-[10px]"
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
                        <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                          No bookings found for this event.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sponsors">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-card border-white/5">
              <CardHeader>
                <CardTitle className="text-white">Business Applications</CardTitle>
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
          <Card className="bg-card border-white/5">
            <CardHeader>
              <CardTitle className="text-white">Quick Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                <div>
                  <div className="font-bold text-white">Sponsor Bookings</div>
                  <div className="text-sm text-muted-foreground">Enable or disable business sponsorship applications</div>
                </div>
                <Button variant="outline" className="border-primary/20 text-primary">Enabled</Button>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                <div>
                  <div className="font-bold text-white">Vendor Bookings</div>
                  <div className="text-sm text-muted-foreground">Enable or disable vendor space applications</div>
                </div>
                <Button variant="outline" className="border-primary/20 text-primary">Enabled</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
