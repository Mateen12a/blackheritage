import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, DollarSign, Landmark, ShieldAlert, CheckCircle2, Sliders, RefreshCw, AlertCircle, ArrowUpRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AdminFinancialOverview({ onNavigateToLedger }: { onNavigateToLedger?: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/admin/financial-overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/financial-overview", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load financial overview");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const [ticketBpsInput, setTicketBpsInput] = useState<string>("");
  const [vendorBpsInput, setVendorBpsInput] = useState<string>("");
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  // Seed inputs when data loads
  React.useEffect(() => {
    if (data?.settings && !isEditingSettings) {
      setTicketBpsInput(String((data.settings.ticketCommissionBps || 600) / 100));
      setVendorBpsInput(String((data.settings.vendorCommissionBps || 1250) / 100));
    }
  }, [data, isEditingSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async ({ ticketPct, vendorPct }: { ticketPct: number; vendorPct: number }) => {
      const res = await fetch("/api/platform/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ticketCommissionBps: Math.round(ticketPct * 100),
          vendorCommissionBps: Math.round(vendorPct * 100),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Could not update platform settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financial-overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/settings"] });
      setIsEditingSettings(false);
      toast({ title: "Commission settings updated", description: "New commission rates are active immediately." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    },
  });

  const money = (kobo: number) => `₦${(Number(kobo || 0) / 100).toLocaleString("en-NG")}`;

  if (isLoading) {
    return (
      <div className="py-16 text-center text-muted-ink">
        <Loader2 className="w-7 h-7 animate-spin mx-auto text-gold mb-3" />
        <p className="text-sm">Calculating platform telemetry and financials…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-hairline bg-surface p-6 text-center">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-ink">Failed to load financial overview</p>
        <p className="text-xs text-muted-ink mt-1">{(error as any)?.message || "Internal server error"}</p>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-4 text-xs">
          Retry
        </Button>
      </Card>
    );
  }

  const isLiveMode = data.gateway?.mode === "live";

  return (
    <div className="space-y-6">
      {/* Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-hairline bg-surface-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-ink uppercase font-bold text-[10px] tracking-wider">Gateway Status:</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold font-mono text-[11px] border ${
                isLiveMode
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveMode ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
              {isLiveMode ? "PAYSTACK PRODUCTION (LIVE)" : "TEST MODE (SIMULATED)"}
            </span>
          </div>

          <div className="h-3.5 w-px bg-hairline hidden sm:block" />

          <div className="text-muted-ink">
            Organizers: <strong className="text-ink font-mono">{data.counts?.verifiedOrganizers}</strong> verified of{" "}
            <span className="font-mono">{data.counts?.totalOrganizers}</span> total
          </div>

          <div className="h-3.5 w-px bg-hairline hidden sm:block" />

          <div className="text-muted-ink">
            Events: <strong className="text-ink font-mono">{data.counts?.liveEvents}</strong> live of{" "}
            <span className="font-mono">{data.counts?.totalEvents}</span> created
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-7 px-2 text-muted-ink hover:text-ink text-xs ml-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-surface border-hairline">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-ink text-xs font-semibold uppercase tracking-wider">
              <span>Gross Volume (GMV)</span>
              <DollarSign className="w-4 h-4 text-gold" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono text-ink mt-2">
              {money(data.gmvKobo)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-ink">
            <span className="font-mono font-semibold text-ink">{data.paidOrdersCount}</span> completed orders &middot;{" "}
            <span className="font-mono font-semibold text-ink">{data.ticketsMintedCount}</span> tickets issued
          </CardContent>
        </Card>

        <Card className="bg-surface border-hairline">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-ink text-xs font-semibold uppercase tracking-wider">
              <span>Net Platform Revenue</span>
              <Landmark className="w-4 h-4 text-emerald-400" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono text-emerald-400 mt-2">
              {money(data.platformFeesKobo)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-ink">
            Retained platform fees on ticket sales
          </CardContent>
        </Card>

        <Card className="bg-surface border-hairline">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-ink text-xs font-semibold uppercase tracking-wider">
              <span>Pending Escrow</span>
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono text-amber-400 mt-2">
              {money(data.pendingEscrowKobo)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-ink">
            Protected funds held for unverified organizers
          </CardContent>
        </Card>

        <Card className="bg-surface border-hairline">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-muted-ink text-xs font-semibold uppercase tracking-wider">
              <span>Settled Disbursements</span>
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
            </div>
            <CardTitle className="text-2xl font-bold font-mono text-sky-400 mt-2">
              {money(data.settledPayoutsKobo)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-[11px] text-muted-ink">
            Directly split via Paystack subaccounts or paid out
          </CardContent>
        </Card>
      </div>

      {/* Platform Commission Controls & Settlement Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-surface border-hairline">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-ink flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-gold" />
                  Platform Commission Rates
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Global rate parameters applied during automated ticket checkout and vendor contracts.
                </CardDescription>
              </div>
              {!isEditingSettings && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingSettings(true)}
                  className="h-8 text-xs border-hairline text-ink hover:text-gold"
                >
                  Adjust Rates
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingSettings ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const tPct = parseFloat(ticketBpsInput);
                  const vPct = parseFloat(vendorBpsInput);
                  if (isNaN(tPct) || tPct < 0 || tPct > 20) {
                    toast({ variant: "destructive", title: "Invalid ticket rate", description: "Must be between 0% and 20%." });
                    return;
                  }
                  if (isNaN(vPct) || vPct < 0 || vPct > 30) {
                    toast({ variant: "destructive", title: "Invalid vendor rate", description: "Must be between 0% and 30%." });
                    return;
                  }
                  updateSettingsMutation.mutate({ ticketPct: tPct, vendorPct: vPct });
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-ink uppercase">Ticket Commission (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="20"
                      value={ticketBpsInput}
                      onChange={(e) => setTicketBpsInput(e.target.value)}
                      className="bg-surface-2 border-hairline text-ink font-mono text-sm"
                      placeholder="6.0"
                    />
                    <p className="text-[10px] text-muted-ink">Default: 6.0% (600 bps)</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-ink uppercase">Vendor Commission (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="30"
                      value={vendorBpsInput}
                      onChange={(e) => setVendorBpsInput(e.target.value)}
                      className="bg-surface-2 border-hairline text-ink font-mono text-sm"
                      placeholder="12.5"
                    />
                    <p className="text-[10px] text-muted-ink">Default: 12.5% (1250 bps)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={updateSettingsMutation.isPending}
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-gold-soft text-xs h-8 px-4"
                  >
                    {updateSettingsMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    Save Commission Rates
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingSettings(false)}
                    className="text-xs h-8 text-muted-ink hover:text-ink"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg border border-hairline bg-surface-2">
                  <span className="text-[11px] text-muted-ink uppercase font-semibold">Ticket Commission</span>
                  <div className="text-xl font-bold font-mono text-gold mt-1">
                    {(data.settings?.ticketCommissionBps / 100).toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-muted-ink font-mono">{data.settings?.ticketCommissionBps} bps</span>
                </div>

                <div className="p-3.5 rounded-lg border border-hairline bg-surface-2">
                  <span className="text-[11px] text-muted-ink uppercase font-semibold">Vendor Commission</span>
                  <div className="text-xl font-bold font-mono text-gold mt-1">
                    {(data.settings?.vendorCommissionBps / 100).toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-muted-ink font-mono">{data.settings?.vendorCommissionBps} bps</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Operations Overview */}
        <Card className="bg-surface border-hairline">
          <CardHeader>
            <CardTitle className="text-base text-ink">Disbursement Summary</CardTitle>
            <CardDescription className="text-xs">
              State of ticket revenue splits and pending transfers to organizer accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-hairline">
              <span className="text-muted-ink">Disbursed to Bank Accounts:</span>
              <span className="font-mono font-bold text-sky-400">{money(data.settledPayoutsKobo)}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-hairline">
              <span className="text-muted-ink">Pending Verification (Locked Escrow):</span>
              <span className="font-mono font-bold text-amber-400">{money(data.pendingEscrowKobo)}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-hairline">
              <span className="text-muted-ink">Ready for Transfer (Due):</span>
              <span className="font-mono font-bold text-emerald-400">{money(data.duePayoutsKobo)}</span>
            </div>

            {onNavigateToLedger && (
              <div className="pt-2">
                <Button
                  onClick={onNavigateToLedger}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-hairline text-ink hover:text-gold flex items-center justify-center gap-1.5"
                >
                  <span>Open Full Payouts & Settlements Ledger</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
