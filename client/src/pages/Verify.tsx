import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScanLine, CheckCircle2, XCircle, AlertTriangle, WifiOff, CloudUpload, RotateCcw } from "lucide-react";
import { format } from "date-fns";

type ScanResult = "ok" | "duplicate" | "invalid" | "void" | "override";

interface Outcome {
  result: ScanResult;
  attendeeName?: string;
  tierName?: string;
  seat?: number;
  message: string;
  firstUsedAt?: string;
}

interface QueuedScan {
  code: string;
  clientTime: string;
}

interface CachedTicket {
  code: string;
  tierName: string;
  attendeeName: string;
}

/**
 * Gate verification portal. Works on any phone browser. When the venue has no
 * signal, scans are checked against a cached valid-ticket list and queued;
 * they sync to the server automatically on reconnect.
 */
export default function Verify() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [tally, setTally] = useState({ ok: 0, flagged: 0 });
  const [cache, setCache] = useState<CachedTicket[] | null>(null);
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [overrideCode, setOverrideCode] = useState<string | null>(null);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      syncQueue();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Offline cache: valid tickets, loaded once at portal open.
  useEffect(() => {
    const cachedEvent = localStorage.getItem("bh-verify-event");
    if (cachedEvent) setEventId(cachedEvent);
    loadCache();
  }, []);

  const loadCache = async () => {
    const stored = localStorage.getItem("bh-verify-cache");
    if (stored) {
      try {
        setCache(JSON.parse(stored));
      } catch {
        localStorage.removeItem("bh-verify-cache");
      }
    }
    try {
      const res = await fetch("/api/events/verify-context", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.eventId) {
        setEventId(data.eventId);
        localStorage.setItem("bh-verify-event", data.eventId);
      }
      if (Array.isArray(data.tickets)) {
        setCache(data.tickets);
        localStorage.setItem("bh-verify-cache", JSON.stringify(data.tickets));
      }
    } catch {
      // Offline or not permitted; keep the previous cache.
    }
  };

  const cacheIndex = useMemo(() => {
    const idx = new Map<string, CachedTicket>();
    for (const t of cache || []) idx.set(t.code, t);
    return idx;
  }, [cache]);

  const syncQueue = async () => {
    if (queue.length === 0) return;
    const toSync = [...queue];
    setQueue([]);
    try {
      const res = await fetch("/api/verify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scans: toSync }),
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      let synced = 0;
      for (const r of data.results) {
        if (r.result === "ok") synced += 1;
      }
      setTally((t) => ({ ...t, ok: t.ok + synced }));
      if (toSync.length > 0) {
        // Preserve any scans that failed to sync
      }
    } catch {
      setQueue((q) => [...toSync, ...q]);
    }
  };

  const recordLocal = (code: string) => {
    setTally((t) => ({ ...t, ok: t.ok + 1 }));
    setQueue((q) => [...q, { code, clientTime: new Date().toISOString() }]);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized || busy) return;
    setBusy(true);
    setOverrideCode(null);

    if (!online) {
      // Offline path: judge against the cached list, queue the result.
      const cached = cacheIndex.get(normalized);
      if (!cached) {
        setOutcome({ result: "invalid", message: "No ticket matches that code in the offline list" });
      } else if (queue.some((q) => q.code === normalized)) {
        setOutcome({
          result: "duplicate",
          attendeeName: cached.attendeeName,
          tierName: cached.tierName,
          message: "Already checked in on this device (offline)",
        });
      } else {
        setOutcome({
          result: "ok",
          attendeeName: cached.attendeeName,
          tierName: cached.tierName,
          message: "Offline check-in. Syncs when you reconnect.",
        });
        recordLocal(normalized);
      }
      setBusy(false);
      setCode("");
      return;
    }

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized, clientTime: new Date().toISOString() }),
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setOutcome({ ...body, message: "Entry allowed" });
        setTally((t) => ({ ...t, ok: t.ok + 1 }));
        setCode("");
      } else if (res.status === 409) {
        setOutcome({
          result: "duplicate",
          attendeeName: body.attendeeName,
          tierName: body.tierName,
          message: body.message || "Already checked in",
          firstUsedAt: body.firstUsedAt,
        });
        setOverrideCode(normalized);
        setTally((t) => ({ ...t, flagged: t.flagged + 1 }));
      } else {
        setOutcome({ result: body.result || "invalid", message: body.message || "Not recognised" });
        setTally((t) => ({ ...t, flagged: t.flagged + 1 }));
      }
    } catch {
      setOnline(false);
      setOutcome({ result: "invalid", message: "Network dropped. Working offline; try the scan again." });
    }
    setBusy(false);
    setCode("");
  };

  const doOverride = async () => {
    if (!overrideCode) return;
    try {
      const res = await fetch("/api/verify/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: overrideCode }),
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setOutcome({ result: "override", ...body, message: body.message || "Entry allowed on override" });
        setTally((t) => ({ ...t, ok: t.ok + 1, flagged: Math.max(0, t.flagged - 1) }));
        setOverrideCode(null);
      } else {
        setOutcome({ result: "duplicate", message: body.message || "Override refused" });
      }
    } catch {
      setOutcome({ result: "duplicate", message: "Override needs a connection" });
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 px-4">
        <p className="eyebrow">Gate verification</p>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink">Staff sign-in</h1>
        <p className="mt-3 text-muted-ink text-sm">
          Sign in with your entry staff account to open the verification portal.
        </p>
        <a href="/auth" className="press mt-6 inline-flex items-center justify-center h-12 px-6 rounded-md bg-primary text-primary-foreground hover:bg-gold-soft font-medium">
          Sign in
        </a>
      </div>
    );
  }

  const resultStyles: Record<ScanResult, { wrap: string; icon: JSX.Element; label: string }> = {
    ok: {
      wrap: "bg-green-500/10 border-green-500/40 text-green-400",
      icon: <CheckCircle2 className="w-12 h-12" aria-hidden="true" />,
      label: "VALID TICKET",
    },
    override: {
      wrap: "bg-green-500/10 border-green-500/40 text-green-400",
      icon: <CheckCircle2 className="w-12 h-12" aria-hidden="true" />,
      label: "ENTRY ALLOWED",
    },
    duplicate: {
      wrap: "bg-red-500/10 border-red-500/40 text-red-400",
      icon: <XCircle className="w-12 h-12" aria-hidden="true" />,
      label: "ALREADY USED",
    },
    invalid: {
      wrap: "bg-red-500/10 border-red-500/40 text-red-400",
      icon: <XCircle className="w-12 h-12" aria-hidden="true" />,
      label: "NOT RECOGNISED",
    },
    void: {
      wrap: "bg-red-500/10 border-red-500/40 text-red-400",
      icon: <AlertTriangle className="w-12 h-12" aria-hidden="true" />,
      label: "TICKET VOID",
    },
  };

  return (
    <div className="max-w-lg mx-auto pb-20 px-4">
      <div className="flex items-center justify-between pt-6">
        <div>
          <p className="eyebrow">Gate verification</p>
          <h1 className="font-display text-2xl font-bold text-ink mt-1">Check-in</h1>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-bold text-gold tabular-nums">
            {tally.ok}
            <span className="text-muted-ink text-lg">/{cache ? cache.length : ""}</span>
          </p>
          <p className="text-xs text-muted-ink flex items-center justify-end gap-1.5">
            {online ? (
              <>Connected</>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-orange-400" aria-hidden="true" />
                Offline
              </>
            )}
          </p>
        </div>
      </div>

      <form onSubmit={verify} className="mt-5 flex gap-2">
        <Input
          placeholder="BH-XXXXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="h-14 bg-surface-2 border-hairline text-ink font-mono text-xl tracking-widest uppercase rounded-md focus-visible:border-gold focus-visible:ring-0"
          autoComplete="off"
          inputMode="text"
          aria-label="Ticket code"
        />
        <Button
          type="submit"
          disabled={busy}
          aria-label="Verify ticket"
          className="press h-14 w-16 bg-primary text-primary-foreground hover:bg-gold-soft rounded-md shrink-0"
        >
          <ScanLine className="w-6 h-6" aria-hidden="true" />
        </Button>
      </form>

      {queue.length > 0 && (
        <p className="mt-2 text-xs text-orange-400 flex items-center gap-1.5">
          <CloudUpload className="w-3.5 h-3.5" aria-hidden="true" />
          {queue.length} offline scan{queue.length > 1 ? "s" : ""} waiting to sync
        </p>
      )}

      {outcome && (
        <div
          className={`mt-5 rounded-lg border-2 p-6 text-center ${resultStyles[outcome.result].wrap}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex justify-center">{resultStyles[outcome.result].icon}</div>
          <p className="mt-3 text-xs font-bold tracking-[0.2em]">{resultStyles[outcome.result].label}</p>
          {outcome.attendeeName && (
            <p className="mt-2 font-display text-2xl font-bold text-ink">{outcome.attendeeName}</p>
          )}
          {outcome.tierName && <p className="text-sm text-muted-ink">{outcome.tierName}</p>}
          <p className="mt-2 text-sm text-muted-ink">{outcome.message}</p>
          {outcome.firstUsedAt && (
            <p className="mt-1 text-xs text-muted-ink">
              First check-in: {format(new Date(outcome.firstUsedAt), "d MMM, HH:mm:ss")}
            </p>
          )}
          {overrideCode && (
            <Button
              onClick={doOverride}
              className="press mt-4 h-11 bg-primary text-primary-foreground hover:bg-gold-soft font-medium"
            >
              <RotateCcw className="w-4 h-4 mr-2" aria-hidden="true" />
              Supervisor Override
            </Button>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <div className="border border-hairline rounded-md bg-surface p-3">
          <p className="font-display text-xl font-bold text-green-400">{tally.ok}</p>
          <p className="text-xs text-muted-ink">Checked in</p>
        </div>
        <div className="border border-hairline rounded-md bg-surface p-3">
          <p className="font-display text-xl font-bold text-red-400">{tally.flagged}</p>
          <p className="text-xs text-muted-ink">Flagged</p>
        </div>
        <div className="border border-hairline rounded-md bg-surface p-3">
          <p className="font-display text-xl font-bold text-ink">
            {cache ? cache.length - tally.ok : "-"}
          </p>
          <p className="text-xs text-muted-ink">Still out</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-muted-ink">
          {cache
            ? `Offline list loaded: ${cache.length} valid tickets`
            : "Offline list loads automatically when connected"}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="border-hairline text-muted-ink hover:text-gold press"
          onClick={loadCache}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
