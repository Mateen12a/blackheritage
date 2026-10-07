import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Download, ExternalLink, Ticket, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export function AdminTransactionsLedger() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: bookings, isLoading, refetch, isFetching } = useQuery<any[]>({
    queryKey: ["/api/admin/bookings", search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "150");
      const res = await fetch(`/api/admin/bookings?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load transactions");
      return res.json();
    },
  });

  const money = (kobo: number) => `₦${(Number(kobo || 0) / 100).toLocaleString("en-NG")}`;

  const exportCSV = () => {
    if (!bookings || bookings.length === 0) return;
    const rows = [
      ["Reference", "Date", "Customer Name", "Customer Email", "Event", "Tier", "Qty", "Amount (Kobo)", "Status", "Gateway", "Subaccount Split"],
      ...bookings.map((b) => [
        b.paymentReference,
        b.createdAt ? new Date(b.createdAt).toISOString() : "",
        b.name,
        b.email,
        b.event?.title || b.eventId,
        b.ticketType,
        b.quantity,
        b.totalAmount,
        b.status,
        b.paymentGateway || "paystack",
        b.subaccountSplit ? "Yes" : "No",
      ]),
    ];
    const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `transactions-ledger-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="border-hairline bg-surface">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base text-ink flex items-center gap-2">
              <Ticket className="w-4 h-4 text-gold" />
              Global Transactions Ledger
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Cross-platform audit log of every ticket booking and Paystack payment reference.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={!bookings || bookings.length === 0}
            className="press h-8 text-xs border-hairline text-ink hover:text-gold self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-ink" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Paystack reference (BH-...), email, attendee name..."
              className="h-9 pl-9 text-xs bg-surface-2 border-hairline text-ink"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {["all", "paid", "pending", "abandoned"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`h-9 px-3 rounded-md text-xs font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-surface-2 text-muted-ink hover:text-ink border border-hairline"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="py-16 text-center text-muted-ink">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gold mb-2" />
            Loading transaction records…
          </div>
        ) : !bookings || bookings.length === 0 ? (
          <div className="py-12 text-center text-muted-ink text-xs">
            No transactions match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left text-xs text-ink">
              <thead className="border-b border-hairline bg-surface-2 text-muted-ink uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-6">Reference</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Tier / Qty</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Gateway</th>
                  <th className="py-3 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {bookings.map((b) => {
                  const isPaid = b.status === "paid";
                  const isPending = b.status === "pending";
                  const isFree = Number(b.totalAmount || 0) === 0;

                  return (
                    <tr key={b.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="py-3 px-6 font-mono font-semibold text-ink">
                        {b.paymentReference}
                      </td>
                      <td className="py-3 px-4 text-muted-ink text-[11px] whitespace-nowrap">
                        {b.createdAt ? format(new Date(b.createdAt), "dd MMM, HH:mm") : "-"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-ink truncate max-w-[150px]">{b.name}</div>
                        <div className="text-muted-ink text-[11px] font-mono truncate max-w-[150px]">{b.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        {b.event ? (
                          <Link href={`/events/${b.event.slug || b.event.id}`}>
                            <span className="text-ink hover:text-gold transition-colors font-medium truncate max-w-[160px] block cursor-pointer">
                              {b.event.title}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-muted-ink">Unknown Event</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-ink font-medium">{b.ticketType}</span>
                        <span className="text-muted-ink ml-1 font-mono">&times;{b.quantity}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-ink whitespace-nowrap">
                        {isFree ? <span className="text-emerald-400">₦0 (Free)</span> : money(b.totalAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-muted-ink uppercase">
                            {b.paymentGateway || "paystack"}
                          </span>
                          {b.subaccountSplit && (
                            <span className="px-1.5 py-0.2 rounded bg-gold/10 text-gold text-[9px] font-bold uppercase tracking-wider border border-gold/20">
                              Split
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-6 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                            isPaid
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : isPending
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-surface-2 text-muted-ink border-hairline"
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Paid
                            </>
                          ) : isPending ? (
                            <>
                              <Clock className="w-3 h-3" />
                              Pending
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3" />
                              {b.status}
                            </>
                          )}
                        </span>
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
  );
}
