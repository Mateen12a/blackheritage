import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Check, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Organizer onboarding progress: one compact card, honest conditions pulled
 * from live account data. Disappears entirely once everything is done —
 * finished organizers don't need a trophy, they need a clean dashboard.
 */

interface Step {
  key: string;
  label: string;
  done: boolean;
  href: string;
  cta: string;
}

export function SetupChecklist() {
  const [, setLocation] = useLocation();

  const { data } = useQuery({
    queryKey: ["/api/setup-checklist"],
    queryFn: async () => {
      const res = await fetch("/api/setup-checklist", { credentials: "include" });
      if (!res.ok) throw new Error("not ready");
      return res.json() as Promise<{ steps: Step[]; complete: number; total: number }>;
    },
    staleTime: 30_000,
    retry: false,
  });

  if (!data) return null;
  const { steps, complete, total } = data;
  if (complete >= total) return null;
  const pct = Math.round((complete / total) * 100);

  return (
    <Card className="border-hairline bg-surface">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-ink text-base">Your setup</CardTitle>
            <CardDescription>
              {complete} of {total} complete
              {complete === 0 ? " — start with the first one below." : " — keep going."}
            </CardDescription>
          </div>
          <span className="font-display text-2xl font-bold text-gold shrink-0">{pct}%</span>
        </div>
        {/* progress rail */}
        <div className="mt-2 h-1 w-full rounded-full bg-surface-2 overflow-hidden" aria-hidden="true">
          <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          {steps.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5 py-1.5">
              {s.done ? (
                <Check className="w-4 h-4 text-gold shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="w-4 h-4 text-muted-ink/40 shrink-0" aria-hidden="true" />
              )}
              {s.done ? (
                <span className="text-sm text-muted-ink line-through decoration-muted-ink/30">{s.label}</span>
              ) : (
                <button
                  onClick={() => setLocation(s.href)}
                  className="text-sm text-ink hover:text-gold transition-colors text-left cursor-pointer"
                >
                  {s.label}
                  <span className="text-gold ml-1.5 text-xs">{s.cta} →</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
