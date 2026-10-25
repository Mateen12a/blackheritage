import { useMemo, useState } from "react";
import { Copy, Check, Link2, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cleanVia } from "@/lib/via";

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

/**
 * Promoter links and the leaderboard they feed. Each promoter or page gets
 * a link ending in ?via=<name>; paid tickets bought through it are counted
 * here, so commission is paid on real sales and nobody types a code.
 */
export function SalesBySource({ event, bookings }: { event: any; bookings: any[] | undefined }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const base = typeof window !== "undefined"
    ? `${window.location.origin}${event?.slug ? `/e/${event.slug}` : `/events/${event?.id}`}`
    : "";
  const via = cleanVia(name);
  const link = via ? `${base}?via=${via}` : "";

  const rows = useMemo(() => {
    const by = new Map<string, { tickets: number; orders: number; kobo: number }>();
    for (const b of bookings || []) {
      if (b.status !== "paid") continue;
      const key = b.source || "direct";
      const r = by.get(key) || { tickets: 0, orders: 0, kobo: 0 };
      r.tickets += Number(b.quantity || 0);
      r.orders += 1;
      r.kobo += Number(b.totalAmount || 0) - Number(b.serviceFeeKobo || 0);
      by.set(key, r);
    }
    return Array.from(by.entries())
      .map(([source, r]) => ({ source, ...r }))
      .sort((a, b) => (a.source === "direct" ? 1 : b.source === "direct" ? -1 : b.tickets - a.tickets));
  }, [bookings]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast({ title: "Could not copy", description: text });
    }
  };

  return (
    <Card className="bg-surface border-hairline">
      <CardHeader>
        <CardTitle className="text-ink flex items-center gap-2">
          <Trophy className="w-4 h-4 text-gold" /> Promoter links &amp; sales
        </CardTitle>
        <CardDescription>
          Give every promoter or page their own link. Tickets bought through it count for them here, with no promo code needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="via-name" className="text-sm text-ink">Promoter or page name</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="via-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. tobi, lagos_events, lasustech"
              className="bg-surface-2 border-hairline"
            />
            <Button
              type="button"
              disabled={!link}
              onClick={() => copy(link, "new")}
              className="press bg-primary text-primary-foreground hover:bg-gold-soft shrink-0"
            >
              {copied === "new" ? <Check className="w-4 h-4 mr-1.5" /> : <Link2 className="w-4 h-4 mr-1.5" />}
              {copied === "new" ? "Copied" : "Copy their link"}
            </Button>
          </div>
          {link && <p className="text-xs text-muted-ink break-all">{link}</p>}
        </div>

        <div className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-ink py-4">No paid tickets yet. Sales show up here, by promoter, as they come in.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-ink border-b border-hairline">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium text-right">Tickets</th>
                  <th className="py-2 pr-3 font-medium text-right">Sales</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((r, i) => (
                  <tr key={r.source}>
                    <td className="py-2.5 pr-3 text-muted-ink tabular-nums">{r.source === "direct" ? "-" : i + 1}</td>
                    <td className="py-2.5 pr-3 text-ink">
                      {r.source === "direct" ? <span className="text-muted-ink">Direct (no link)</span> : r.source}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-ink font-semibold tabular-nums">{r.tickets}</td>
                    <td className="py-2.5 pr-3 text-right text-muted-ink tabular-nums">{naira(r.kobo)}</td>
                    <td className="py-2.5 text-right">
                      {r.source !== "direct" && (
                        <button
                          type="button"
                          onClick={() => copy(`${base}?via=${r.source}`, r.source)}
                          className="text-xs text-gold hover:text-gold-soft inline-flex items-center gap-1"
                          aria-label={`Copy ${r.source}'s link`}
                        >
                          {copied === r.source ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          Link
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
