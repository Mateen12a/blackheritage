import { useMutation, useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { EventForm } from "@/components/EventForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

/**
 * Edit an existing event. The same form the create page uses, prefilled from
 * the event's current values and saved through the PATCH route.
 *
 * The server already refuses price or capacity cuts below the tickets already
 * sold (the update schema floors them), so a paid event cannot be silently
 * oversold from this screen. Everything an organizer changes here is live for
 * published events the moment the save lands.
 */
export default function EditEvent({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: event, isLoading, error: loadError } = useQuery<any, Error>({
    queryKey: [buildUrl(api.events.get.path, { id })],
    queryFn: async () => {
      const res = await fetch(buildUrl(api.events.get.path, { id }), { credentials: "include" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Could not load that event");
      return j;
    },
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(buildUrl(api.events.update.path, { id }), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Could not save your changes");
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.events.list.path] });
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.events.get.path, { id })] });
      toast({ title: "Changes saved" });
      setLocation("/admin");
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (loadError || !event) {
    return (
      <div className="container mx-auto px-4 pt-16 max-w-2xl text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Event unavailable</h1>
        <p className="text-sm text-muted-ink mt-2">{loadError?.message || "This event may have been deleted."}</p>
      </div>
    );
  }

  // Shape the stored event into what the form expects: a Date for the
  // calendar, and the branding object rather than the raw row.
  const initialData = {
    ...event,
    date: event.date ? new Date(event.date) : undefined,
    branding: event.branding || null,
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto px-4 pt-10 max-w-2xl">
        <p className="eyebrow">Edit listing</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink tracking-tight">{event.title}</h1>
        <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
        <p className="text-xs text-muted-ink mt-4">
          {event.status === "published"
            ? "This event is live. Saved changes appear on the public page right away."
            : "This event is not published yet. Complete the details and publish when ready."}
        </p>

        <Card className="bg-surface border-hairline mt-8">
          <CardHeader>
            <CardTitle className="text-ink">Event Details</CardTitle>
          </CardHeader>
          <CardContent>
            <EventForm
              initialData={initialData}
              onSubmit={(data) => mutation.mutate(data)}
              isLoading={mutation.isPending}
              allowDraft={event.status !== "published"}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
