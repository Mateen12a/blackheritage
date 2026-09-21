import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Navbar } from "@/components/Navbar";
import { EventForm } from "@/components/EventForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function NewEvent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.events.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create event");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.events.list.path] });
      toast({ title: "Event created successfully" });
      setLocation("/admin");
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 max-w-2xl">
        <p className="eyebrow">New listing</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink tracking-tight">Create New Event</h1>
        <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
        
        <Card className="bg-surface border-hairline mt-8">
          <CardHeader>
            <CardTitle className="text-ink">Event Details</CardTitle>
          </CardHeader>
          <CardContent>
            <EventForm 
              onSubmit={(data) => mutation.mutate(data)} 
              isLoading={mutation.isPending} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
