import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * /unsubscribe?t=<token>: organizer emails. The page asks before acting, so
 * mail scanners that open every link can't unsubscribe anyone by accident.
 * /unsubscribed (no token): where the older one-tap links land.
 */
export default function UnsubscribePage() {
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("t") : null;
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");

  const { data, isLoading, isError } = useQuery<{ organizerName: string; email: string; unsubscribed: boolean }>({
    queryKey: ["/api/email/unsubscribe", token, "info"],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/email/unsubscribe/${encodeURIComponent(token as string)}/info`);
      if (!res.ok) throw new Error("invalid");
      return res.json();
    },
  });

  const confirm = async () => {
    setState("working");
    try {
      const res = await fetch(`${BASE_URL}/api/email/unsubscribe/${encodeURIComponent(token as string)}`, { method: "POST" });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  let title = "You're unsubscribed";
  let body: React.ReactNode = "You won't get these emails again. Your tickets and ticket emails aren't affected.";
  let action: React.ReactNode = null;

  if (token) {
    if (isLoading) {
      title = "One moment";
      body = (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking your link
        </span>
      );
    } else if (isError || !data) {
      title = "This link has expired";
      body = "We couldn't read this unsubscribe link. Reply to the email you got and the organizer will take you off their list.";
    } else if (state === "done" || data.unsubscribed) {
      title = "You're unsubscribed";
      body = `${data.email} won't get emails from ${data.organizerName} through Black Heritage again. Your tickets and ticket emails aren't affected.`;
    } else {
      title = `Stop emails from ${data.organizerName}?`;
      body = `${data.email} will stop getting ${data.organizerName}'s emails sent through Black Heritage. Your tickets and ticket emails aren't affected.`;
      action = (
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={confirm} disabled={state === "working"} className="press bg-primary text-primary-foreground hover:bg-gold-soft">
            {state === "working" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Unsubscribe
          </Button>
          <Link href="/">
            <Button variant="outline" className="border-hairline text-ink">
              Keep getting them
            </Button>
          </Link>
        </div>
      );
      if (state === "error") body = "That didn't go through. Check your connection and tap Unsubscribe again.";
    }
  }

  return (
    <div className="min-h-[70vh] bg-background px-4 py-16">
      <div className="mx-auto max-w-lg rounded-md border border-hairline bg-surface p-6 sm:p-8">
        <MailX className="h-6 w-6 text-gold" aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-ink">{body}</p>
        {action}
        {!action && (
          <Link href="/events" className="mt-6 inline-block text-sm text-ink underline decoration-hairline underline-offset-4 hover:text-gold">
            See what's on this week
          </Link>
        )}
      </div>
    </div>
  );
}
