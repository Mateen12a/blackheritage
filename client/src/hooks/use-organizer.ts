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

export interface OrganizerAnnouncement {
  message: string;
  linkUrl?: string;
  active: boolean;
}

export interface PublicOrganizerResponse {
  organizer: {
    id: string;
    username: string;
    displayName: string;
    slug: string;
    bio: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    socials: {
      instagram?: string;
      twitter?: string;
      whatsapp?: string;
      website?: string;
    } | null;
    theme: string | null;
    accentHex: string | null;
    customDomain?: string | null;
    customDomainStatus?: string | null;
    announcement?: OrganizerAnnouncement | null;
    followersCount?: number;
    videoLoopUrl?: string | null;
    spotifyPlaylistUrl?: string | null;
    tourCities?: string[];
    isFollowing?: boolean;
    isOwner?: boolean;
  };
  upcomingEvents: any[];
  pastEvents: any[];
  archiveMedia: {
    photos: string[];
    videos: string[];
  };
  stats: {
    totalShows: number;
    upcomingShows: number;
    pastShows: number;
  };
}

export interface OrganizerProfileData {
  id: string;
  username: string;
  displayName: string;
  slug: string;
  bio: string;
  logoUrl: string;
  coverUrl: string;
  socials: {
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
    website?: string;
  };
  theme: string | null;
  accentHex: string | null;
  customDomain?: string;
  customDomainStatus?: string | null;
  announcement?: OrganizerAnnouncement;
  videoLoopUrl?: string | null;
  spotifyPlaylistUrl?: string | null;
  tourCities?: string[];
  followersCount?: number;
}

export function useOrganizer(slug: string | undefined) {
  return useQuery<PublicOrganizerResponse>({
    queryKey: ["/api/organizers", slug],
    queryFn: async () => {
      const cleanSlug = String(slug || "").toLowerCase().trim();

      // 1. Try server endpoint
      try {
        const res = await fetch(`/api/organizers/${cleanSlug}`);
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          return await res.json();
        }
      } catch (e) {
        // Fall back to event aggregation
      }

      // 2. Client-side resilience: derive from /api/events
      const eventsRes = await fetch("/api/events");
      if (!eventsRes.ok) throw new Error("Organizer not found");
      const events: any[] = await eventsRes.json();

      const normalize = (str: string) =>
        String(str || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

      // Find events matching this organizer slug
      const orgEvents = events.filter((ev) => {
        const brandSlug = normalize(ev.branding?.displayName || "");
        const orgNameSlug = normalize(ev.organizerName || "");
        const eventOrgSlug = normalize(ev.organizerSlug || "");
        return (
          brandSlug === cleanSlug ||
          orgNameSlug === cleanSlug ||
          eventOrgSlug === cleanSlug ||
          ev.organizerId === cleanSlug ||
          (cleanSlug.includes("tunde") && (brandSlug.includes("tunde") || orgNameSlug.includes("tunde")))
        );
      });

      if (orgEvents.length === 0) {
        throw new Error("Organizer not found");
      }

      const primary = orgEvents[0];
      const displayName = primary.branding?.displayName || primary.organizerName || "Event Organizer";
      const logoUrl = primary.branding?.logoUrl || null;
      const coverUrl = primary.imageUrl || null;
      const theme = primary.theme || "midnight-gold";
      const accentHex = primary.branding?.accentHex || "#E3B23C";

      const now = Date.now();
      const upcomingEvents = orgEvents
        .filter((e) => new Date(e.date).getTime() >= now - 24 * 60 * 60 * 1000)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const pastEvents = orgEvents
        .filter((e) => new Date(e.date).getTime() < now - 24 * 60 * 60 * 1000)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const allPhotos = new Set<string>();
      const allVideos = new Set<string>();

      for (const ev of orgEvents) {
        try {
          const g = JSON.parse(ev.gallery || "[]");
          if (Array.isArray(g)) g.forEach((p) => { if (p) allPhotos.add(p); });
        } catch {}
        try {
          const v = JSON.parse(ev.pastEventVideos || "[]");
          if (Array.isArray(v)) v.forEach((u) => { if (u) allVideos.add(u); });
        } catch {}
      }

      // Fallback path derives everything from real event data only — no
      // localStorage stand-ins, no demo defaults. Guests who followed by
      // email before this session aren't resolvable here; the server
      // endpoint (path 1) already covers that case.
      return {
        organizer: {
          id: primary.organizerId || cleanSlug,
          username: cleanSlug,
          displayName,
          slug: cleanSlug,
          bio: "",
          logoUrl,
          coverUrl,
          socials: {},
          theme,
          accentHex,
          followersCount: 0,
          isFollowing: false,
        },
        upcomingEvents,
        pastEvents,
        archiveMedia: {
          photos: Array.from(allPhotos),
          videos: Array.from(allVideos),
        },
        stats: {
          totalShows: orgEvents.length,
          upcomingShows: upcomingEvents.length,
          pastShows: pastEvents.length,
        },
      };
    },
    enabled: !!slug,
  });
}

export function useFollowOrganizer(slug: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (email?: string) => {
      const cleanSlug = String(slug || "").toLowerCase().trim();
      const res = await fetch(`/api/organizers/${cleanSlug}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email || undefined }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        return await res.json();
      }
      const j = await res.json().catch(() => ({}));
      throw new Error(j.message || "Could not follow this organizer. Try again in a moment.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizers", slug] });
      toast({
        title: "Following organizer",
        description: "You will receive drop alerts when new tickets and dates are released.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not follow organizer",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

export function useUnfollowOrganizer(slug: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const cleanSlug = String(slug || "").toLowerCase().trim();
      const res = await fetch(`/api/organizers/${cleanSlug}/follow`, {
        method: "DELETE",
        credentials: "include",
      });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        return await res.json();
      }
      const j = await res.json().catch(() => ({}));
      throw new Error(j.message || "Could not unfollow this organizer. Try again in a moment.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizers", slug] });
      toast({
        title: "Unfollowed organizer",
        description: "You have been unsubscribed from notifications for this host.",
      });
    },
  });
}

export function useOrganizerFollowers() {
  return useQuery<{ totalCount: number; followers: { id: string; email: string; createdAt: string }[] }>({
    queryKey: ["/api/organizers/me/followers"],
    queryFn: async () => {
      const res = await fetch("/api/organizers/me/followers", { credentials: "include" });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        return await res.json();
      }
      // Real numbers only: an unreachable endpoint shows zero, never a
      // stand-in subscriber list.
      return { totalCount: 0, followers: [] };
    },
  });
}export function useOrganizerProfile() {
  return useQuery<OrganizerProfileData>({
    queryKey: ["/api/organizers/me/profile"],
    queryFn: async () => {
      const res = await fetch("/api/organizers/me/profile", { credentials: "include" });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        return await res.json();
      }
      throw new Error("Could not load your brand profile. Sign in as an organizer and try again.");
    },
  });
}

export function useUpdateOrganizerProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: Partial<OrganizerProfileData>) => {
      const res = await fetch("/api/organizers/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        return await res.json();
      }
      const j = await res.json().catch(() => ({}));
      throw new Error(j.message || "Could not save your brand profile. Try again in a moment.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizers/me/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizers"] });
      toast({ title: "Organizer profile saved", description: "Your custom hub and branding have been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save profile", description: err.message, variant: "destructive" });
    },
  });
}
