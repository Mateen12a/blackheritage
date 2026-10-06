import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminVerifyOrganizer } from "@/hooks/use-account";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BadgeCheck, CheckCircle2, Clock, AlertCircle, Landmark, ShieldCheck, Check, X, Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export function AdminVerificationsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const verifyMutation = useAdminVerifyOrganizer();

  const { data: organizers, isLoading: orgsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/organizers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/organizers", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load organizers");
      return res.json();
    },
  });

  const { data: payouts, isLoading: payoutsLoading } = useQuery<any[]>({
    queryKey: ["/api/payouts"],
    queryFn: async () => {
      const res = await fetch("/api/payouts", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load payouts");
      return res.json();
    },
  });

  const settleMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const res = await fetch(`/api/payouts/${payoutId}/settle`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Could not settle payout");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payouts"] });
      toast({ title: "Payout settled", description: "Status updated to settled." });
    },
    onError: (err: any) => {
      toast({ title: "Settlement failed", description: err.message, variant: "destructive" });
    },
  });

  const money = (kobo: number) => `₦${(Number(kobo || 0) / 100).toLocaleString("en-NG")}`;

  return (
    <div className="space-y-8">
      {/* Organizers Verification Section */}
      <Card className="border-hairline bg-surface">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-ink flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-gold" />
                Organizer Verifications & KYC
              </CardTitle>
              <CardDescription className="mt-1">
                Verify organizer legal credentials to unlock automated Paystack subaccount split payouts.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {orgsLoading ? (
            <div className="py-12 text-center text-muted-ink">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-gold mb-2" />
              Loading organizer verifications…
            </div>
          ) : !organizers || organizers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-ink">No organizers registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-ink">
                <thead className="border-b border-hairline bg-surface-2 text-muted-ink uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Organizer</th>
                    <th className="py-3 px-4">KYC Details</th>
                    <th className="py-3 px-4">Bank & Subaccount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {organizers.map((org: any) => {
                    const isVer = Boolean(org.isVerified);
                    const isPending = org.verificationStatus === "pending";
                    const bank = org.bankDetails;
                    const kyc = org.verificationDetails;

                    return (
                      <tr key={org.id} className="hover:bg-surface-2/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-ink">{org.displayName || org.username}</div>
                          <div className="text-muted-ink font-mono text-[11px]">{org.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {kyc ? (
                            <div>
                              <div className="text-ink font-medium">{kyc.businessName}</div>
                              <div className="text-muted-ink text-[11px]">
                                {kyc.cacNumber ? `RC: ${kyc.cacNumber} · ` : ""}
                                {kyc.idType}: {kyc.bvnLast4 ? `••••${kyc.bvnLast4}` : kyc.idNumber || "On file"}
                              </div>
                              {kyc.phone && <div className="text-muted-ink text-[11px] font-mono">{kyc.phone}</div>}
                            </div>
                          ) : (
                            <span className="text-muted-ink italic">No KYC submitted</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          {bank?.accountNumber ? (
                            <div>
                              <div className="text-ink font-sans font-medium">{bank.bankName}</div>
                              <div className="text-muted-ink text-[11px]">
                                •••• {bank.accountNumber.slice(-4)} &middot; {bank.accountName}
                              </div>
                              {bank.subaccountCode ? (
                                <span className="inline-block text-[10px] bg-background border border-hairline px-1.5 py-0.5 rounded text-gold mt-0.5">
                                  {bank.subaccountCode}
                                </span>
                              ) : (
                                <span className="text-amber-400 text-[10px]">No subaccount</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-ink italic font-sans">No bank linked</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {isVer ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
                              <BadgeCheck className="w-3.5 h-3.5" />
                              Verified
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                              <Clock className="w-3.5 h-3.5" />
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-ink bg-surface-2 border border-hairline px-2 py-0.5 rounded-full">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Unverified
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isVer ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => verifyMutation.mutate({ id: org.id, verified: true })}
                                disabled={verifyMutation.isPending}
                                className="h-7 text-xs border-gold/40 text-gold hover:bg-gold/10"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Verify
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => verifyMutation.mutate({ id: org.id, verified: false })}
                                disabled={verifyMutation.isPending}
                                className="h-7 text-xs text-muted-ink hover:text-red-400"
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payouts Ledger Section */}
      <Card className="border-hairline bg-surface">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-ink flex items-center gap-2">
                <Landmark className="w-5 h-5 text-gold" />
                Payouts & Settlements Ledger
              </CardTitle>
              <CardDescription className="mt-1">
                All platform commissions, promoter shares, and organizer payout disbursements.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {payoutsLoading ? (
            <div className="py-12 text-center text-muted-ink">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-gold mb-2" />
              Loading payouts…
            </div>
          ) : !payouts || payouts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-ink">No payouts recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-ink">
                <thead className="border-b border-hairline bg-surface-2 text-muted-ink uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Kind</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status & Note</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {payouts.map((p: any) => {
                    const isSettled = p.status === "settled";
                    const isPendingVer = p.status === "pending_verification";

                    return (
                      <tr key={p.id} className="hover:bg-surface-2/40 transition-colors">
                        <td className="py-3.5 px-4 text-muted-ink font-mono text-[11px]">
                          {p.createdAt ? format(new Date(p.createdAt), "dd MMM yyyy") : "—"}
                        </td>
                        <td className="py-3.5 px-4 font-medium">
                          {p.kind === "platform_fee"
                            ? "Platform Fee"
                            : p.kind === "promoter_commission"
                            ? "Promoter Share"
                            : "Organizer Net"}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-ink">{p.recipientName}</div>
                          {p.recipientId && <div className="text-[10px] text-muted-ink font-mono">{p.recipientId}</div>}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-ink">
                          {money(p.amount)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                isSettled
                                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                  : isPendingVer
                                  ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                  : "text-muted-ink bg-surface-2 border-hairline"
                              }`}
                            >
                              {isSettled ? "Settled" : isPendingVer ? "Pending Verification" : "Due"}
                            </span>
                            {p.note && <div className="text-[11px] text-muted-ink mt-0.5">{p.note}</div>}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {!isSettled && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => settleMutation.mutate(p.id)}
                              disabled={settleMutation.isPending || isPendingVer}
                              className="h-7 text-xs border-hairline text-ink hover:text-gold"
                            >
                              {settleMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Settle"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
