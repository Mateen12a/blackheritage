import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const BASE_URL = import.meta.env.VITE_API_URL || "";

export type EmailReason = "guest" | "checkout" | "follower" | "import";

export interface AudienceContact {
  email: string;
  name: string | null;
  reason: EmailReason;
  reasons: EmailReason[];
  eventIds: string[];
}

export interface AudienceEvent {
  id: string;
  title: string;
  date: string | null;
  upcoming: boolean;
  status: string;
  reachable: number;
}

export interface Audience {
  contacts: AudienceContact[];
  events: AudienceEvent[];
  stats: {
    total: number;
    guests: number;
    optedIn: number;
    followers: number;
    imported: number;
    unsubscribed: number;
    bounced: number;
    hiddenPastGuests: number;
  };
}

export interface EmailQuota {
  orgCap: number;
  sentToday: number;
  leftToday: number;
  queued: number;
  resetsAt: string;
  configured: boolean;
  fromAddress: string;
}

export interface BroadcastSummary {
  id: string;
  subject: string;
  eventId: string | null;
  status: "sending" | "sent" | "stopped";
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  queued: number;
  createdAt: string;
  completedAt: string | null;
}

export interface ComposeFields {
  subject: string;
  message: string;
  eventId?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  replyTo?: string | null;
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Something went wrong. Try again in a moment.");
  return data as T;
}

const KEYS = {
  audience: ["/api/organizer/email/audience"],
  quota: ["/api/organizer/email/quota"],
  broadcasts: ["/api/organizer/email/broadcasts"],
};

export function useEmailAudience() {
  return useQuery<Audience>({ queryKey: KEYS.audience, queryFn: () => call("GET", "/api/organizer/email/audience") });
}

export function useEmailQuota() {
  return useQuery<EmailQuota>({
    queryKey: KEYS.quota,
    queryFn: () => call("GET", "/api/organizer/email/quota"),
    refetchInterval: 60_000,
  });
}

export function useBroadcasts() {
  return useQuery<BroadcastSummary[]>({
    queryKey: KEYS.broadcasts,
    queryFn: () => call("GET", "/api/organizer/email/broadcasts"),
    // Poll only while something is still going out.
    refetchInterval: (q) => ((q.state.data || []).some((b) => b.status === "sending") ? 20_000 : false),
  });
}

export function useImportContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { text: string; consent: boolean }) =>
      call<{ added: number; alreadyOnList: number; unsubscribed: number; invalid: number }>(
        "POST",
        "/api/organizer/email/contacts/import",
        body,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.audience }),
  });
}

export function useRemoveContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => call("DELETE", "/api/organizer/email/contacts", { email }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.audience }),
  });
}

export function useSendTestEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ComposeFields) => call<{ ok: boolean; to: string }>("POST", "/api/organizer/email/test", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.quota }),
  });
}

export function useSendBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ComposeFields & { recipients: string[] }) =>
      call<{ id: string; recipients: number; dropped: number; sendingToday: number; extraDays: number }>(
        "POST",
        "/api/organizer/email/broadcasts",
        body,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.broadcasts });
      qc.invalidateQueries({ queryKey: KEYS.quota });
    },
  });
}

export function useStopBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => call<{ ok: boolean; cancelled: number }>("POST", `/api/organizer/email/broadcasts/${id}/stop`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.broadcasts });
      qc.invalidateQueries({ queryKey: KEYS.quota });
    },
  });
}

export async function fetchEmailPreview(body: Partial<ComposeFields>, signal?: AbortSignal) {
  const res = await fetch(`${BASE_URL}/api/organizer/email/preview`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Preview unavailable");
  return data as { html: string; from: string; replyTo: string | null; subject: string };
}
