import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PayoutSummary {
  heldKobo: number;
  readyKobo: number;
  paidKobo: number;
  isVerified: boolean;
  hasBank: boolean;
  autoSplit: boolean;
  lastRequestedAt: string | null;
}

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

/**
 * The organizer's money in one row: held until verification, ready to pay,
 * and already paid. Auto-split organizers are paid by Paystack directly, so
 * the request button only appears when the platform holds the money.
 */
export function PayoutBalance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<PayoutSummary>({
    queryKey: ["/api/payouts/summary"],
    queryFn: async () => {
      const res = await fetch("/api/payouts/summary", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load your balance");
      return res.json();
    },
  });

  const request = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/payouts/request", { method: "POST", credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not send the request");
      return body;
    },
    onSuccess: (body: any) => {
      toast({ title: "Payout requested", description: `${naira(body.totalKobo)} goes to your bank within one business day.` });
      queryClient.invalidateQueries({ queryKey: ["/api/payouts/summary"] });
    },
    onError: (err: any) => toast({ title: "Payout not requested", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !data) {
    return <div className="h-24 rounded-md border border-hairline bg-surface-2 animate-pulse" />;
  }

  const cells = [
    { label: "Held", value: data.heldKobo, hint: "Released once you are verified" },
    { label: "Ready to pay", value: data.readyKobo, hint: data.autoSplit ? "Paystack pays you automatically" : "Request it below" },
    { label: "Paid out", value: data.paidKobo, hint: "Sent to your bank" },
  ];

  return (
    <div className="rounded-md border border-hairline bg-surface-2 p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cells.map((c) => (
          <div key={c.label}>
            <p className="text-xs text-muted-ink">{c.label}</p>
            <p className="font-display text-2xl font-bold text-ink tabular-nums">{naira(c.value)}</p>
            <p className="text-[11px] text-muted-ink">{c.hint}</p>
          </div>
        ))}
      </div>
      {!data.autoSplit && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-hairline pt-4">
          <p className="text-xs text-muted-ink">
            {!data.isVerified
              ? "Verify your identity below to release held sales."
              : !data.hasBank
                ? "Add your bank account to receive payouts."
                : "Paid to your bank within one business day of your request."}
          </p>
          <Button
            type="button"
            onClick={() => request.mutate()}
            disabled={request.isPending || data.readyKobo <= 0 || !data.isVerified || !data.hasBank}
            className="press bg-primary text-primary-foreground hover:bg-gold-soft h-9 text-xs font-semibold"
          >
            {request.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            Request {naira(data.readyKobo)}
          </Button>
        </div>
      )}
    </div>
  );
}
