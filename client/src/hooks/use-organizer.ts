import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface PromoView {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
}

export function usePromos(eventId: string | null) {
  return useQuery<PromoView[]>({
    queryKey: ["/api/events", eventId, "promos"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/promos`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load promo codes");
      return res.json();
    },
    enabled: !!eventId,
  });
}

export function useCreatePromo(eventId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      code: string;
      kind: "percent" | "fixed";
      value: number;
      maxUses?: number | null;
      expiresAt?: string | null;
    }) => {
      const res = await fetch(`/api/events/${eventId}/promos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not create the code");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "promos"] });
      toast({ title: "Promo code created" });
    },
    onError: (err: Error) =>
      toast({ title: "Code not created", description: err.message, variant: "destructive" }),
  });
}

export function useDeletePromo(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (promoId: string) => {
      const res = await fetch(`/api/promos/${promoId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Could not delete the code");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "promos"] }),
  });
}

export function useIssueManualTickets(eventId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      email: string;
      tierName?: string;
      quantity: number;
    }) => {
      const res = await fetch(`/api/events/${eventId}/manual-tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not issue tickets");
      return body as { tickets: { code: string; attendeeName: string; attendeeEmail: string }[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      toast({
        title: `Issued ${data.tickets.length} ticket${data.tickets.length > 1 ? "s" : ""}`,
        description: `Codes emailed to ${data.tickets[0]?.attendeeEmail}`,
      });
    },
    onError: (err: Error) =>
      toast({ title: "Tickets not issued", description: err.message, variant: "destructive" }),
  });
}

export function useRefundBooking(eventId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await fetch(`/api/bookings/${bookingId}/refund`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Refund failed");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      toast({ title: "Refund processed", description: "The customer has been notified and the ticket voided." });
    },
    onError: (err: Error) =>
      toast({ title: "Refund failed", description: err.message, variant: "destructive" }),
  });
}

export interface LiveStats {
  expected: number;
  checkedIn: number;
  remaining: number;
  lastCheckInAt: string | null;
  flagged: number;
}

export function useLiveStats(eventId: string | null, refetchMs = 8000) {
  return useQuery<LiveStats>({
    queryKey: ["/api/events", eventId, "live-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/live-stats`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load live stats");
      return res.json();
    },
    enabled: !!eventId,
    refetchInterval: refetchMs,
  });
}

export interface TeamMember {
  id: string;
  username: string;
  email: string;
  staffRole: string;
  createdAt: string;
}

export function useTeam(enabled: boolean) {
  return useQuery<TeamMember[]>({
    queryKey: ["/api/team"],
    queryFn: async () => {
      const res = await fetch("/api/team", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load your team");
      return res.json();
    },
    enabled,
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: { username: string; email: string; password: string; staffRole: string }) => {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not add the member");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Team member added", description: "Share the password with them so they can sign in." });
    },
    onError: (err: Error) =>
      toast({ title: "Not added", description: err.message, variant: "destructive" }),
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/team/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Could not remove the member");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/team"] }),
  });
}
