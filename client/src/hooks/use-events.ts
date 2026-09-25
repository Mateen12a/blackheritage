import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Same-origin API in dev/preview (vite proxies /api → localhost:3001);
// production can override with VITE_API_URL.
const BASE_URL = import.meta.env.VITE_API_URL || "";

export function useEvents() {
  return useQuery({
    queryKey: [`${BASE_URL}${api.events.list.path}`],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}${api.events.list.path}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      return api.events.list.responses[200].parse(data);
    },
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: [`${BASE_URL}${api.events.get.path}`, id],
    queryFn: async () => {
      // /e/:slug pages pass the slug; the id route passes a raw id. Both hit
      // the same shape of payload; the slug endpoint reads the same rows.
      const isSlug = !/^[0-9a-fA-F]{24}$/.test(id) && !/^event-/.test(id);
      // Access code rides on both paths: sessionStorage wins (the guest
      // already unlocked it once), then the ?code= URL param, then any
      // invite token from a personal invite link.
      const stored = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(`bh-access-${id}`) : null;
      const qs = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const code = stored || qs.get("code") || "";
      const invite = qs.get("invite") || "";
      const extra = new URLSearchParams();
      if (code) extra.set("code", code);
      if (invite) extra.set("invite", invite);
      const suffix = extra.toString() ? `?${extra.toString()}` : "";
      const url = isSlug
        ? `${BASE_URL}/api/events/by-slug/${encodeURIComponent(id)}${suffix}`
        : `${BASE_URL}${buildUrl(api.events.get.path, { id: id as any })}${suffix}`;
      const res = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (res.status === 404) return null;
      // Invite-only events 403 with { requiresCode: true } until the right
      // access code (or invite token) rides along. Surface the marker so the
      // page can show its gate screen instead of a hard error.
      if (res.status === 403) {
        const body = await res.json().catch(() => null);
        if (body?.requiresCode) return { __requiresCode: true, title: body.title || null };
        throw new Error("Failed to fetch event");
      }
      if (!res.ok) throw new Error("Failed to fetch event");
      const data = await res.json();
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (eventData: any) => {
      const res = await fetch(`${BASE_URL}${api.events.create.path}`, {
        method: api.events.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
        credentials: "include"
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.events.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create event");
      }
      return api.events.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${BASE_URL}${api.events.list.path}`] });
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
