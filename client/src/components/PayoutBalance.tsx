import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface Withdrawal {
  id: string;
  amountKobo: number;
  feeKobo: number;
  netKobo: number;
  status: "processing" | "success" | "failed" | "reversed";
  failureReason: string | null;
  bank?: { bankName?: string; accountNumber?: string };
  createdAt: string;
}

interface PayoutSummary {
  heldKobo: number;
  readyKobo: number;
  paidKobo: number;
  isVerified: boolean;
  hasBank: boolean;
  autoSplit: boolean;
  lastRequestedAt: string | null;
  instant?: boolean;
  processingKobo?: number;
  withdrawFeeKobo?: number;
  withdrawals?: Withdrawal[];
  canWithdraw?: boolean;
}

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

/**
 * The organizer's money. With instant payouts on it is a wallet: available
 * balance, one-tap withdrawal to their bank, and the withdrawal history.
 * Otherwise auto-split organizers are paid by Paystack directly, and the
 * request button only appears when the platform holds the money.
 */
export function PayoutBalance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data, isLoading } = useQuery<PayoutSummary>({
    queryKey: ["/api/payouts/summary"],
    queryFn: async () => {
      const res = await fetch("/api/payouts/summary", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load your balance");
      return res.json();
    },
    // While a transfer is on its way, check back until it lands.
    refetchInterval: (q) => ((q.state.data as PayoutSummary | undefined)?.processingKobo ? 8000 : false),
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

  const withdraw = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wallet/withdraw", { method: "POST", credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "The withdrawal could not start");
      return body;
    },
    onSuccess: (body: any) => {
      toast({
        title: body.status === "success" ? "Sent to your bank" : "On its way",
        description:
          body.status === "success"
            ? `${naira(body.netKobo)} has been sent.`
            : `${naira(body.netKobo)} is on its way to your bank. Usually under a minute.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payouts/summary"] });
    },
    onError: (err: any) => {
      toast({ title: "Withdrawal not sent", description: err.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/payouts/summary"] });
    },
  });

  if (isLoading || !data) {
    return <div className="h-24 rounded-md border border-hairline bg-surface-2 animate-pulse" />;
  }

  if (data.instant) {
    const available = data.readyKobo;
    const fee = data.withdrawFeeKobo || 0;
    const blocker = !data.isVerified
      ? "Verify your identity below to unlock withdrawals."
      : !data.hasBank
        ? "Link your bank account below to withdraw."
        : available <= 0
          ? "Sales land here as they happen. Withdraw any time."
          : available - fee < 10000
            ? "The minimum withdrawal is ₦100 after the transfer fee."
            : null;
    const cells = [
      { label: "Available", value: available, hint: "Yours to withdraw now" },
      { label: "On its way", value: data.processingKobo || 0, hint: "Transfers in progress" },
      { label: "Withdrawn", value: data.paidKobo, hint: "Sent to your bank" },
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
        {data.heldKobo > 0 && (
          <p className="text-xs text-amber-300">
            {naira(data.heldKobo)} is held until your identity is verified, then it moves to Available.
          </p>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-hairline pt-4">
          <p className="text-xs text-muted-ink">
            {blocker || `Transfer fee ${naira(fee)}. You receive ${naira(available - fee)}, usually within a minute.`}
          </p>
          {data.canWithdraw !== false && (
            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={withdraw.isPending || Boolean(blocker)}
              className="press bg-primary text-primary-foreground hover:bg-gold-soft h-10 px-5 text-sm font-semibold"
            >
              {withdraw.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Withdraw {naira(Math.max(0, available - fee))}
            </Button>
          )}
        </div>

        {data.withdrawals && data.withdrawals.length > 0 && (
          <div className="border-t border-hairline pt-3">
            <p className="text-xs text-muted-ink mb-2">Recent withdrawals</p>
            <ul className="divide-y divide-hairline">
              {data.withdrawals.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    {w.status === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : w.status === "processing" ? (
                      <Clock className="w-4 h-4 text-gold shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span className="truncate text-ink">
                      {naira(w.netKobo)}
                      <span className="text-muted-ink">
                        {" · "}
                        {w.status === "success"
                          ? "sent"
                          : w.status === "processing"
                            ? "on its way"
                            : "returned to your balance"}
                      </span>
                    </span>
                  </span>
                  <span className="text-xs text-muted-ink shrink-0">
                    {new Date(w.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="bg-surface border-hairline">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-ink">Withdraw {naira(available - fee)}?</AlertDialogTitle>
              <AlertDialogDescription>
                {naira(available)} available, minus the {naira(fee)} transfer fee. It goes to your linked bank account and usually arrives within a minute.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-hairline">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => withdraw.mutate()}
                className="bg-primary text-primary-foreground hover:bg-gold-soft"
              >
                Withdraw
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  const cells = [
    { label: "Held", value: data.heldKobo, hint: "Released once you are verified" },
    { label: "Ready to pay", value: data.readyKobo, hint: data.autoSplit ? "Paid to your bank automatically" : "Request it below" },
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
