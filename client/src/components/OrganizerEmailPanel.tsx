import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  Check,
  FileUp,
  Loader2,
  Mail,
  Search,
  Send,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import {
  fetchEmailPreview,
  useBroadcasts,
  useEmailAudience,
  useEmailQuota,
  useImportContacts,
  useRemoveContact,
  useSendBroadcast,
  useSendTestEmail,
  useStopBroadcast,
  type AudienceContact,
  type ComposeFields,
  type EmailReason,
} from "@/hooks/use-organizer-email";

/**
 * Organizer email. Three steps on one screen: pick who gets it, write it,
 * check the phone preview and send. The server decides who is reachable and
 * enforces the daily caps; this screen explains both in plain words.
 */

type Filter = "all" | EmailReason;

const REASON_LABEL: Record<EmailReason, string> = {
  guest: "Has tickets",
  checkout: "Opted in",
  follower: "Follows you",
  import: "Your list",
};

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-NG")} ${n === 1 ? one : many}`;

export function OrganizerEmailPanel({ initialEventId }: { initialEventId?: string | null }) {
  const { toast } = useToast();
  const { data: audience, isLoading: audienceLoading, error: audienceError } = useEmailAudience();
  const { data: quota } = useEmailQuota();
  const { data: history } = useBroadcasts();
  const sendTest = useSendTestEmail();
  const sendBroadcast = useSendBroadcast();
  const stopBroadcast = useStopBroadcast();
  const removeContact = useRemoveContact();

  // ── Audience selection ──
  const [filter, setFilter] = useState<Filter>("all");
  const [eventFilter, setEventFilter] = useState<string>(initialEventId || "");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);

  // ── Compose ──
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [eventId, setEventId] = useState<string>(initialEventId || "");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (audience?.contacts || []).filter((c) => {
      if (filter !== "all" && !c.reasons.includes(filter)) return false;
      if (eventFilter && !c.eventIds.includes(eventFilter)) return false;
      if (q && !c.email.includes(q) && !(c.name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [audience, filter, eventFilter, query]);

  // Arriving from an event's page: start with that event's reachable guests ticked.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !audience || !initialEventId) return;
    seeded.current = true;
    setSelected(new Set(audience.contacts.filter((c) => c.eventIds.includes(initialEventId)).map((c) => c.email)));
  }, [audience, initialEventId]);

  // Drop selections that disappeared (removed contact, fresh unsubscribe).
  useEffect(() => {
    if (!audience) return;
    const valid = new Set(audience.contacts.map((c) => c.email));
    setSelected((prev) => {
      const next = new Set(Array.from(prev).filter((e) => valid.has(e)));
      return next.size === prev.size ? prev : next;
    });
  }, [audience]);

  const allVisibleSelected = visible.length > 0 && visible.every((c) => selected.has(c.email));
  const toggleVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((c) => next.delete(c.email));
      else visible.forEach((c) => next.add(c.email));
      return next;
    });
  };
  const toggleOne = (email: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  const fields: ComposeFields = {
    subject: subject.trim(),
    message: message.trim(),
    eventId: eventId || null,
    ctaLabel: ctaLabel.trim() || null,
    ctaUrl: ctaUrl.trim() || null,
    replyTo: replyTo.trim() || null,
  };

  // ── Live preview, debounced ──
  const [preview, setPreview] = useState<{ html: string; from: string; replyTo: string | null } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetchEmailPreview(fields, ctrl.signal)
        .then((p) => {
          setPreview(p);
          setPreviewError(null);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") setPreviewError(err?.message || "Preview unavailable");
        });
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, message, eventId, ctaLabel, ctaUrl, replyTo]);

  const composeProblem =
    subject.trim().length < 3
      ? "Add a subject line"
      : message.trim().length < 10
        ? "Write your message"
        : ctaUrl.trim() && !/^https:\/\//i.test(ctaUrl.trim())
          ? "Button links must start with https://"
          : null;

  const runTest = () => {
    if (composeProblem) return toast({ variant: "destructive", title: composeProblem });
    sendTest.mutate(fields, {
      onSuccess: (r) => toast({ title: "Test sent", description: `Check ${r.to}. It can take a minute to land.` }),
      onError: (e: any) => toast({ variant: "destructive", title: "Test didn't send", description: e?.message }),
    });
  };

  const runSend = () => {
    setConfirmOpen(false);
    sendBroadcast.mutate(
      { ...fields, recipients: Array.from(selected) },
      {
        onSuccess: (r) => {
          const later = r.recipients - r.sendingToday;
          toast({
            title: `Sending to ${plural(r.recipients, "person", "people")}`,
            description:
              later > 0
                ? `${r.sendingToday.toLocaleString("en-NG")} go out today and the other ${later.toLocaleString("en-NG")} over the next ${plural(r.extraDays, "day")}, inside your daily limit.`
                : "They'll land in the next few minutes.",
          });
          setSelected(new Set());
        },
        onError: (e: any) => toast({ variant: "destructive", title: "Not sent", description: e?.message }),
      },
    );
  };

  const resetsAt = quota ? format(new Date(quota.resetsAt), "h a") : "";
  const leftToday = quota?.leftToday ?? 0;
  const selectedCount = selected.size;
  const chosenEvent = audience?.events.find((e) => e.id === eventId) || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="max-w-3xl">
        <p className="eyebrow">Organizer email</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">Email your guests</h2>
        <div className="rule-gold mt-3" />
        <p className="mt-3 text-sm leading-relaxed text-muted-ink">
          Write once and it goes out under your logo and name. Replies come straight to you, and every email carries a one-tap
          unsubscribe, so your list stays clean.
        </p>
        {quota && (
          <p className="mt-3 text-xs text-muted-ink">
            <span className="font-semibold text-ink">{leftToday.toLocaleString("en-NG")}</span> of {quota.orgCap} sends left today
            {quota.queued > 0 && <> · {quota.queued.toLocaleString("en-NG")} waiting in line</>} · resets at {resetsAt}
          </p>
        )}
      </div>

      {quota && !quota.configured && (
        <div className="flex items-start gap-2 rounded-md border border-hairline bg-surface-2 p-4 text-sm text-muted-ink">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
          Email isn't switched on for this server yet. You can write and preview, and sending opens once it's on.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="min-w-0 space-y-6">
          {/* ── 1. Audience ── */}
          <section className="rounded-md border border-hairline bg-surface" aria-labelledby="email-who">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline p-4 sm:p-5">
              <div className="min-w-0">
                <h3 id="email-who" className="font-display text-lg font-bold text-ink">
                  Who gets it
                </h3>
                <p className="mt-1 text-xs text-muted-ink">
                  {audience ? `${plural(audience.stats.total, "person", "people")} you can reach` : "Loading your list"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportOpen(true)}
                className="press h-9 border-hairline px-3 text-xs text-ink hover:text-gold"
              >
                <UserPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Add your own emails
              </Button>
            </div>

            <div className="space-y-3 p-4 sm:p-5">
              {/* Source chips */}
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Filter by how they know you">
                {(
                  [
                    ["all", "Everyone", audience?.stats.total],
                    ["guest", "Have tickets", audience?.stats.guests],
                    ["checkout", "Opted in", audience?.stats.optedIn],
                    ["follower", "Follow you", audience?.stats.followers],
                    ["import", "Your list", audience?.stats.imported],
                  ] as [Filter, string, number | undefined][]
                ).map(([key, label, n]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    aria-pressed={filter === key}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
                      filter === key ? "border-gold/60 bg-gold/10 text-ink" : "border-hairline text-muted-ink hover:text-ink",
                    )}
                  >
                    {label}
                    {typeof n === "number" && <span className="ml-1.5 tabular-nums text-muted-ink">{n.toLocaleString("en-NG")}</span>}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-ink" aria-hidden="true" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name or email"
                    aria-label="Search your list"
                    className="h-9 bg-surface-2 pl-8 text-sm"
                  />
                </div>
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  aria-label="Only people linked to an event"
                  className="h-9 min-w-0 rounded-md border border-input bg-surface-2 px-2 text-sm text-ink"
                >
                  <option value="">Any event</option>
                  {(audience?.events || []).filter((e) => e.reachable > 0 || e.id === eventFilter).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.reachable})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={toggleVisible}
                  disabled={visible.length === 0}
                  className="text-ink underline decoration-hairline underline-offset-4 hover:text-gold disabled:opacity-40"
                >
                  {allVisibleSelected ? "Clear these" : `Select all ${visible.length.toLocaleString("en-NG")} shown`}
                </button>
                <span className="text-muted-ink">
                  <span className="font-semibold text-ink tabular-nums">{selectedCount.toLocaleString("en-NG")}</span> selected
                  {selectedCount > 0 && (
                    <button type="button" onClick={() => setSelected(new Set())} className="ml-2 underline underline-offset-4 hover:text-ink">
                      Clear all
                    </button>
                  )}
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto rounded-md border border-hairline">
                {audienceLoading ? (
                  <div className="flex items-center gap-2 p-4 text-sm text-muted-ink">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your list
                  </div>
                ) : audienceError ? (
                  <p className="p-4 text-sm text-muted-ink">{(audienceError as Error).message}</p>
                ) : visible.length === 0 ? (
                  <div className="p-4 text-sm text-muted-ink">
                    {audience?.stats.total
                      ? "Nobody matches that. Try another filter or clear the search."
                      : "No one to email yet. Add the emails you already have, or share your event link: buyers who tick “keep me posted” land here."}
                  </div>
                ) : (
                  <ul className="divide-y divide-hairline">
                    {visible.slice(0, 500).map((c) => (
                      <ContactRow
                        key={c.email}
                        contact={c}
                        checked={selected.has(c.email)}
                        onToggle={() => toggleOne(c.email)}
                        onRemove={
                          c.reasons.length === 1 && c.reasons[0] === "import"
                            ? () => removeContact.mutate(c.email)
                            : undefined
                        }
                      />
                    ))}
                    {visible.length > 500 && (
                      <li className="p-3 text-xs text-muted-ink">
                        Showing 500 of {visible.length.toLocaleString("en-NG")}. “Select all” still picks every one of them.
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {audience && (audience.stats.hiddenPastGuests > 0 || audience.stats.unsubscribed > 0) && (
                <p className="text-xs leading-relaxed text-muted-ink">
                  {audience.stats.hiddenPastGuests > 0 && (
                    <>
                      {plural(audience.stats.hiddenPastGuests, "past guest")} didn't tick “keep me posted” at checkout, so they
                      aren't listed. Ticket holders for your upcoming events always are.{" "}
                    </>
                  )}
                  {audience.stats.unsubscribed > 0 && <>{plural(audience.stats.unsubscribed, "person", "people")} unsubscribed and won't get your emails.</>}
                </p>
              )}
            </div>
          </section>

          {/* ── 2. Message ── */}
          <section className="rounded-md border border-hairline bg-surface" aria-labelledby="email-what">
            <div className="border-b border-hairline p-4 sm:p-5">
              <h3 id="email-what" className="font-display text-lg font-bold text-ink">
                Your message
              </h3>
              <p className="mt-1 text-xs text-muted-ink">Each person sees “Hi” and their first name at the top.</p>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <div className="space-y-1.5">
                <Label htmlFor="email-event" className="text-xs text-muted-ink">
                  Feature an event (optional)
                </Label>
                <select
                  id="email-event"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="h-10 w-full min-w-0 rounded-md border border-input bg-surface-2 px-3 text-sm text-ink"
                >
                  <option value="">No event</option>
                  {(audience?.events || []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                      {e.date ? ` · ${format(new Date(e.date), "d MMM")}` : ""}
                      {e.status !== "published" ? " (not live)" : ""}
                    </option>
                  ))}
                </select>
                {chosenEvent && (
                  <p className="text-xs text-muted-ink">
                    Adds the flyer, date, venue and a button straight to the ticket page.
                    {chosenEvent.status !== "published" && " This event isn't live yet, so publish it before you send."}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="email-subject" className="text-xs text-muted-ink">
                    Subject
                  </Label>
                  <span className="text-[11px] tabular-nums text-muted-ink">{subject.length}/120</span>
                </div>
                <Input
                  id="email-subject"
                  value={subject}
                  maxLength={120}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Early bird is open for our next show"
                  className="h-10 bg-surface-2"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email-message" className="text-xs text-muted-ink">
                  Message
                </Label>
                <Textarea
                  id="email-message"
                  value={message}
                  maxLength={5000}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={9}
                  placeholder={"You came through last time, so you hear first.\n\nEarly bird is open now and tables are limited. Tap below to lock yours in."}
                  className="bg-surface-2 text-sm leading-relaxed"
                />
                <p className="text-[11px] text-muted-ink">Leave an empty line between paragraphs. Links you paste become tappable.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email-cta" className="text-xs text-muted-ink">
                    Button text
                  </Label>
                  <Input
                    id="email-cta"
                    value={ctaLabel}
                    maxLength={40}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    placeholder={eventId ? "Get tickets" : "Open link"}
                    className="h-10 bg-surface-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-link" className="text-xs text-muted-ink">
                    {eventId ? "Button link (optional)" : "Button link"}
                  </Label>
                  <Input
                    id="email-link"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder={eventId ? "Uses the ticket page" : "https://"}
                    inputMode="url"
                    className="h-10 bg-surface-2"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email-reply" className="text-xs text-muted-ink">
                  Replies go to
                </Label>
                <Input
                  id="email-reply"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder={preview?.replyTo || "Your account email"}
                  className="h-10 bg-surface-2"
                />
              </div>
            </div>
          </section>
        </div>

        {/* ── 3. Preview + send ── */}
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start" aria-labelledby="email-preview">
          <section className="rounded-md border border-hairline bg-surface">
            <div className="space-y-1 border-b border-hairline p-4">
              <h3 id="email-preview" className="font-display text-lg font-bold text-ink">
                Phone preview
              </h3>
              <p className="truncate text-xs text-muted-ink" title={preview?.from}>
                From <span className="text-ink">{preview?.from || "…"}</span>
              </p>
              <p className="truncate text-xs text-muted-ink">
                Subject <span className="text-ink">{subject.trim() || "Your subject line"}</span>
              </p>
            </div>
            <div className="bg-surface-2 p-3">
              {previewError ? (
                <p className="p-4 text-sm text-muted-ink">{previewError}</p>
              ) : preview ? (
                <iframe
                  title="Email preview"
                  srcDoc={preview.html}
                  sandbox=""
                  className="mx-auto block h-[560px] w-full max-w-[400px] rounded-md border border-hairline bg-white"
                />
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-muted-ink">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Building preview
                </div>
              )}
            </div>
            <div className="space-y-2 border-t border-hairline p-4">
              <Button
                type="button"
                onClick={() => {
                  if (composeProblem) return toast({ variant: "destructive", title: composeProblem });
                  if (selectedCount === 0) return toast({ variant: "destructive", title: "Pick who gets it first" });
                  setConfirmOpen(true);
                }}
                disabled={sendBroadcast.isPending || !quota?.configured}
                className="press h-11 w-full bg-primary text-sm font-medium text-primary-foreground hover:bg-gold-soft"
              >
                {sendBroadcast.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {selectedCount > 0 ? `Send to ${plural(selectedCount, "person", "people")}` : "Send"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={runTest}
                disabled={sendTest.isPending || !quota?.configured}
                className="press h-10 w-full border-hairline text-sm text-ink hover:text-gold"
              >
                {sendTest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="mr-2 h-4 w-4" aria-hidden="true" />}
                Send me a test
              </Button>
              {selectedCount > leftToday && quota?.configured && (
                <p className="text-xs leading-relaxed text-muted-ink">
                  {leftToday.toLocaleString("en-NG")} can go out today. The rest wait in line and send automatically after {resetsAt} each day.
                </p>
              )}
            </div>
          </section>

          {history && history.length > 0 && (
            <section className="rounded-md border border-hairline bg-surface" aria-labelledby="email-history">
              <h3 id="email-history" className="border-b border-hairline p-4 font-display text-lg font-bold text-ink">
                Sent emails
              </h3>
              <ul className="divide-y divide-hairline">
                {history.map((b) => (
                  <li key={b.id} className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{b.subject}</p>
                      <p className="mt-0.5 text-xs text-muted-ink">
                        {format(new Date(b.createdAt), "d MMM, h:mm a")} ·{" "}
                        {b.status === "sending"
                          ? `${b.sentCount} of ${b.recipientCount} sent, ${b.queued} waiting`
                          : b.status === "stopped"
                            ? `Stopped after ${b.sentCount} of ${b.recipientCount}`
                            : `Sent to ${b.sentCount} of ${b.recipientCount}`}
                        {b.failedCount > 0 && ` · ${b.failedCount} didn't go`}
                      </p>
                    </div>
                    {b.status === "sending" ? (
                      <button
                        type="button"
                        onClick={() =>
                          stopBroadcast.mutate(b.id, {
                            onSuccess: (r) => toast({ title: "Stopped", description: `${plural(r.cancelled, "email")} won't go out.` }),
                          })
                        }
                        className="shrink-0 text-xs text-muted-ink underline underline-offset-4 hover:text-ink"
                      >
                        Stop
                      </button>
                    ) : (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-ink" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-hairline bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-ink">Send to {plural(selectedCount, "person", "people")}?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-ink">
              “{subject.trim()}” goes out under your name.
              {selectedCount > leftToday
                ? ` ${leftToday.toLocaleString("en-NG")} send today and the rest follow after ${resetsAt} each day, inside your limit.`
                : " It lands in the next few minutes."}{" "}
              Sent a test first? Once it goes, it can't be edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-hairline">Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={runSend} className="bg-primary text-primary-foreground hover:bg-gold-soft">
              Send it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ContactRow({
  contact,
  checked,
  onToggle,
  onRemove,
}: {
  contact: AudienceContact;
  checked: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`Email ${contact.name || contact.email}`} />
      <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm text-ink">{contact.name || contact.email}</span>
        {contact.name && <span className="block truncate text-xs text-muted-ink">{contact.email}</span>}
      </button>
      <span className="hidden shrink-0 text-[11px] text-muted-ink sm:inline">{REASON_LABEL[contact.reason]}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${contact.email} from your list`}
          className="shrink-0 rounded p-1 text-muted-ink hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const importContacts = useImportContacts();
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const found = useMemo(() => {
    const m = text.match(/[^\s,;<>"'()\t|]+@[^\s,;<>"'()\t|]+\.[a-z]{2,}/gi) || [];
    return new Set(m.map((e) => e.toLowerCase())).size;
  }, [text]);

  const readFile = (file: File) => {
    if (file.size > 2_000_000) {
      toast({ variant: "destructive", title: "That file is over 2 MB", description: "Export only the name and email columns and try again." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setText((prev) => (prev ? `${prev}\n` : "") + String(reader.result || ""));
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  const submit = () => {
    importContacts.mutate(
      { text, consent },
      {
        onSuccess: (r) => {
          const bits = [
            r.alreadyOnList > 0 ? `${r.alreadyOnList} already on your list` : "",
            r.unsubscribed > 0 ? `${r.unsubscribed} unsubscribed before, so skipped` : "",
            r.invalid > 0 ? `${r.invalid} not valid` : "",
          ].filter(Boolean);
          toast({ title: `Added ${plural(r.added, "email")}`, description: bits.join(" · ") || undefined });
          setText("");
          setFileName("");
          setConsent(false);
          onOpenChange(false);
        },
        onError: (e: any) => toast({ variant: "destructive", title: "Not added", description: e?.message }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-hairline bg-surface">
        <DialogHeader>
          <DialogTitle className="font-display text-ink">Add your own emails</DialogTitle>
          <DialogDescription className="text-muted-ink">
            Paste them, one per line (“Name, email” works too), or upload the CSV you exported from Excel, Google Sheets or Outlook.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"Tolu Adeyemi, tolu@example.com\nchidi@example.com"}
            className="bg-surface-2 font-mono text-xs"
            aria-label="Emails to add"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="h-9 border-hairline px-3 text-xs text-ink hover:text-gold">
              <FileUp className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {fileName ? "Add another file" : "Upload CSV"}
            </Button>
            <span className="text-xs text-muted-ink">
              {fileName && <>{fileName} · </>}
              {found > 0 ? `${plural(found, "email")} found` : "No emails yet"}
            </span>
          </div>
          <label className="flex items-start gap-2.5 rounded-md border border-hairline bg-surface-2 p-3 text-xs leading-relaxed text-ink">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <span>
              These people gave me their email and agreed to hear about my events. I understand that anyone who unsubscribes stays off my list.
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={submit}
            disabled={!consent || found === 0 || importContacts.isPending}
            className="press bg-primary text-primary-foreground hover:bg-gold-soft"
          >
            {importContacts.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {found > 0 ? `Add ${plural(found, "email")}` : "Add emails"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
