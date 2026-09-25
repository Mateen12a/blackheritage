import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

/**
 * Guest invites for private events. The organizer pastes one guest per line
 * ("Name, email"), the panel parses and posts them; the server mints a
 * personal token per guest and emails the invite. Status reads back live.
 */

interface InviteRow {
  id: string;
  name: string;
  email: string | null;
  status: string;
  sentAt: string | null;
  viewedAt: string | null;
}

const statusStyle: Record<string, string> = {
  pending: "text-muted-ink",
  viewed: "text-gold",
  purchased: "text-green-500",
};

export function InviteGuestsPanel({ event }: { event: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState("");
  const [sending, setSending] = useState(false);

  const { data: invites } = useQuery<InviteRow[]>({
    queryKey: ["/api/events", String(event.id), "invites"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${event.id}/invites`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!event?.id,
  });

  const guests = (() => {
    const out: { name: string; email?: string }[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [name, email] = trimmed.split(",").map((s) => s.trim());
      if (!name) continue;
      const row: { name: string; email?: string } = { name };
      if (email && email.includes("@")) row.email = email;
      out.push(row);
    }
    return out;
  })();

  const send = async () => {
    if (guests.length === 0) return;
    setSending(true);
    try {
      const res = await fetch(`/api/events/${event.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ guests }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not send invites");
      toast({
        title: `Invites sent to ${body.sent} ${body.sent === 1 ? "guest" : "guests"}`,
        description: body.failed ? `${body.failed} failed: ${body.errors?.join("; ")}` : undefined,
      });
      setRaw("");
      queryClient.invalidateQueries({ queryKey: ["/api/events", String(event.id), "invites"] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Send failed", description: err?.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="bg-surface border-hairline">
      <CardHeader>
        <CardTitle className="text-ink">Invite your guests</CardTitle>
        <CardDescription>
          One guest per line: <span className="text-ink font-medium">Name, email</span>. Each guest gets a
          personal link that opens the event without the access code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"Adaeze Obi, adaeze@example.com\nEmeka N., emeka@example.com\nIfy (no email — share the code instead)"}
          rows={6}
          className="bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold font-mono text-sm"
        />
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-ink">
            {guests.length === 0
              ? "Paste your list above."
              : `${guests.length} ${guests.length === 1 ? "guest" : "guests"} ready.`}
            {guests.length > 200 && <span className="text-red-400"> Max 200 per batch.</span>}
          </p>
          <Button
            onClick={send}
            disabled={sending || guests.length === 0 || guests.length > 200}
            className="press h-11 px-6 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md"
          >
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send invites
          </Button>
        </div>

        {invites && invites.length > 0 && (
          <div className="mt-6">
            <h4 className="eyebrow mb-3">Sent invites</h4>
            <div className="border border-hairline rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 text-left">
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-ink">Guest</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-ink">Email</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-muted-ink">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv) => (
                    <tr key={inv.id} className="border-t border-hairline">
                      <td className="px-4 py-2.5 text-ink">{inv.name}</td>
                      <td className="px-4 py-2.5 text-muted-ink truncate max-w-[16rem]">{inv.email || "—"}</td>
                      <td className={`px-4 py-2.5 font-medium ${statusStyle[inv.status] || "text-muted-ink"}`}>
                        {inv.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
