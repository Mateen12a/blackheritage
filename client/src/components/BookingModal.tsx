import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Event } from "@shared/schema";
import { EMAIL_HINT, isValidEmail } from "@shared/email";
import React, { useState, useEffect } from "react";
import {
  useBookingQuote,
  useInitiateBooking,
  useFinalizeBooking,
} from "@/hooks/use-bookings";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CreditCard, Tag, Check, AlertTriangle, Ticket, Minus, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { TicketReveal, type RevealTicket } from "@/components/TicketReveal";
import { loadPaystack } from "@/lib/paystack";

declare global {
  interface Window {
    PaystackPop: any;
  }
}

interface BookingModalProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
}

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`;

export function BookingModal({ event, isOpen, onClose }: BookingModalProps) {
  const { user } = useAuth();
  // The reveal state lives here so the buy sheet can hand off to it:
  // confirm, close the buy sheet, open the moment.
  const [revealedTickets, setRevealedTickets] = useState<RevealTicket[] | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [promoCode, setPromoCode] = useState("");
  const [promoTouched, setPromoTouched] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [tableNote, setTableNote] = useState("");
  const { mutateAsync: initiate, isPending: isInitiating } = useInitiateBooking();
  const { mutateAsync: finalize, isPending: isFinalizing } = useFinalizeBooking();
  const { toast } = useToast();

  const ticketTypes = React.useMemo(() => {
    try {
      const types = JSON.parse(event.ticketTypes || "[]");
      if (types.length === 0) {
        return [{ name: "Regular", price: event.price, capacity: event.capacity, sold: 0 }];
      }
      return types;
    } catch {
      return [{ name: "Regular", price: event.price, capacity: event.capacity, sold: 0 }];
    }
  }, [event]);

  // Start fetching Paystack the moment the dialog opens, not on page load.
  useEffect(() => {
    if (isOpen) void loadPaystack();
  }, [isOpen]);

  useEffect(() => {
    if (ticketTypes.length > 0 && !selectedTier) {
      setSelectedTier(ticketTypes[0].name);
    }
  }, [ticketTypes, selectedTier]);

  // Prefill for signed-in users: display name (falls back to username) and
  // the account email. Guests type their details in.
  useEffect(() => {
    if (isOpen && user) {
      const accountName = user.displayName || user.username || "";
      setName((n) => n || accountName);
      setEmail((e) => e || user.email || "");
    }
  }, [isOpen, user]);

  // Server-computed pricing. Debounced while the promo code is being typed.
  const [debouncedPromo, setDebouncedPromo] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPromo(promoCode), 600);
    return () => clearTimeout(t);
  }, [promoCode]);

  const quote = useBookingQuote(
    isOpen ? String(event.id) : null,
    selectedTier,
    quantity,
    debouncedPromo,
  );
  const pricing = quote.data;
  const promoFailed = promoTouched && debouncedPromo.trim().length > 2 && quote.isError;

  // Only offer a code field when the organizer has a live code to redeem.
  const { data: promoState } = useQuery<{ active: boolean }>({
    queryKey: ["/api/events", String(event.id), "has-promos"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${event.id}/has-promos`);
      return res.ok ? res.json() : { active: false };
    },
    enabled: isOpen,
    staleTime: 60_000,
  });
  const hasPromos = !!promoState?.active;
  const [promoOpen, setPromoOpen] = useState(false);

  const currentType = ticketTypes.find((t: any) => t.name === selectedTier) || ticketTypes[0];
  const isTable = /table/i.test(currentType?.name || "");
  const busy = isInitiating || isFinalizing;

  // The organizer's selling preferences drive this whole modal.
  const [phone, setPhone] = useState("");
  const [dietaryNote, setDietaryNote] = useState("");
  const settings = {
    showRemainingCounts: (event as any).showRemainingCounts !== false,
    checkoutFields: (event as any).checkoutFields || { phone: false, tableNote: true, dietaryNote: false },
  };
  const showCounts = settings.showRemainingCounts;
  const fields = settings.checkoutFields;
  const wantsPhone = !!fields?.phone;
  const wantsDietary = !!fields?.dietaryNote;
  // Table details belong to table tiers. The organizer's global tableNote
  // switch adds the field to every tier, so respect that too, but a plain
  // GA/VIP ticket never asks for seating info on its own.
  const wantsTable = isTable || (!!fields?.tableNote && currentType?.name === "Table Booking");
  const tableHint = isTable
    ? "Group size or seating preference"
    : "Anything we should know about your group";

  const handleBooking = async () => {
    if (!email.trim() || !name.trim()) {
      toast({
        variant: "destructive",
        title: "Almost there",
        description: "Add your name and email so your ticket has somewhere to go.",
      });
      return;
    }
    // The ticket is delivered by email, so a typo here means a buyer with no
    // ticket. Catch it before taking their money.
    if (!isValidEmail(email)) {
      toast({
        variant: "destructive",
        title: "Check that email address",
        description: EMAIL_HINT,
      });
      return;
    }

    try {
      const init = await initiate({
        eventId: String(event.id),
        tierName: selectedTier,
        quantity,
        name: name.trim(),
        email: email.trim(),
        promoCode: debouncedPromo.trim().toUpperCase() || undefined,
        tableNote: wantsTable && tableNote.trim() ? tableNote.trim() : undefined,
        phone: wantsPhone && phone.trim() ? phone.trim() : undefined,
        dietaryNote: wantsDietary && dietaryNote.trim() ? dietaryNote.trim() : undefined,
        guest: !user,
      });

      // Free tickets (₦0) or dev simulated gateway: confirmed immediately without opening payment gateway
      if (init.isFree || init.status === "paid" || init.simulated || !init.paymentUrl) {
        if (init.tickets && init.tickets.length > 0) {
          showSuccess({ tickets: init.tickets });
          return;
        }
        const result = await finalize(init.reference);
        showSuccess(result);
        return;
      }

      // Real gateway: open hosted page or inline popup, then verify
      // the reference server-side. The client callback is never trusted.
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      // The server already initialized this transaction (amount, split,
      // callback URL), so the popup resumes it by access code rather than
      // starting a new one. v1 inline.js silently ignored onSuccess, which
      // left paid buyers on a spinner with no tickets on screen.
      const PaystackPop = await loadPaystack();
      if (!init.accessCode || typeof PaystackPop !== "function") {
        if (init.paymentUrl) {
          window.location.href = init.paymentUrl;
          return;
        }
        toast({
          variant: "destructive",
          title: "Payment window could not open",
          description: "Disable your popup blocker for this site and try again.",
        });
        return;
      }
      // Close our dialog first: its overlay and focus trap otherwise sit in
      // the same layer as Paystack's checkout and dim it. The ticket reveal
      // renders outside the dialog, so success still lands on this page.
      onClose();
      new PaystackPop().resumeTransaction(init.accessCode, {
        onSuccess: async (response: any) => {
          try {
            const result = await finalize(response.reference || init.reference);
            showSuccess(result);
          } catch (err: any) {
            toast({
              variant: "destructive",
              title: "Payment landed, confirmation is pending",
              description:
                "Your payment reference is " +
                (response.reference || init.reference) +
                ". We verify every payment with the gateway; check My Tickets in a minute or contact support with the reference.",
            });
          }
        },
        onCancel: () => {
          toast({
            title: "Payment window closed",
            description: "Your order is held for a few minutes. Resume any time from the event page.",
          });
        },
        onError: () => {
          // The popup could not load (network, blocker): the hosted page
          // carries the same transaction and returns to this event.
          if (init.paymentUrl) window.location.href = init.paymentUrl;
        },
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Booking didn't go through",
        description: err?.message || "Give it another shot in a moment.",
      });
    }
  };

  const showSuccess = (result: { tickets: RevealTicket[] }) => {
    // Confirmation moment replaces the old toast-and-close: the guest sees
    // their codes immediately, with calendar and share one tap away.
    setRevealedTickets(result.tickets);
    onClose();
  };

  const totalLabel = pricing ? naira(pricing.totalKobo) : "...";
  const fieldClass =
    "h-12 bg-surface-2 border-hairline focus-visible:border-gold focus-visible:ring-0 text-ink rounded-md px-4 text-base";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="bg-surface border-hairline text-ink w-[95vw] sm:max-w-md p-0 overflow-hidden z-[50]"
        onPointerDownOutside={(e) => {
          if (document.querySelector('iframe[src*="paystack"]')) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          if (document.querySelector('iframe[src*="paystack"]')) {
            e.preventDefault();
          }
        }}
      >
        <ScrollArea className="max-h-[90vh]">
          <div className="p-5 sm:p-6 space-y-6">
            <DialogHeader className="text-left space-y-1 pr-8">
              <DialogTitle className="text-xl sm:text-2xl font-display font-bold text-ink leading-tight">
                {event.title}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-ink">
                Choose your ticket. It arrives by email the moment you pay.
              </DialogDescription>
            </DialogHeader>

            <section className="space-y-2" aria-label="Ticket type">
              <div role="radiogroup" className="rounded-md border border-hairline divide-y divide-hairline overflow-hidden">
                {ticketTypes.map((type: any) => {
                  const remaining = Math.max(0, Number(type.capacity || 0) - Number(type.sold || 0));
                  const saleClosed = type.saleClose && new Date(type.saleClose).getTime() < Date.now();
                  const unavailable = remaining <= 0 || saleClosed;
                  const selected = selectedTier === type.name;
                  const status = remaining <= 0
                    ? "Sold out"
                    : saleClosed
                      ? "Sales closed"
                      : showCounts && remaining <= 20
                        ? `Only ${remaining} left`
                        : showCounts
                          ? `${remaining.toLocaleString()} available`
                          : null;
                  return (
                    <button
                      key={type.name}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSelectedTier(type.name)}
                      disabled={unavailable}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                        selected ? "bg-surface-2" : "bg-transparent hover:bg-surface-2/60"
                      } ${unavailable ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-4 h-4 rounded-full border shrink-0 grid place-items-center ${
                          selected ? "border-gold" : "border-white/30"
                        }`}
                      >
                        {selected && <span className="w-2 h-2 rounded-full bg-gold" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-ink truncate">{type.name}</span>
                        {status && (
                          <span className={`block text-xs ${remaining > 0 && remaining <= 20 && !saleClosed ? "text-gold" : "text-muted-ink"}`}>
                            {status}
                          </span>
                        )}
                      </span>
                      <span className="font-display font-bold text-ink tabular-nums">
                        {type.price === 0 ? "Free" : naira(type.price)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-ink">How many?</span>
                <div className="flex items-center rounded-md border border-hairline">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="press w-10 h-10 grid place-items-center text-ink disabled:opacity-30"
                    aria-label="One fewer ticket"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium text-ink tabular-nums" aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                    disabled={quantity >= 10 || (pricing ? quantity >= pricing.available : false)}
                    className="press w-10 h-10 grid place-items-center text-ink disabled:opacity-30"
                    aria-label="One more ticket"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-4" aria-label="Your details">
              <div className="space-y-1.5">
                <label htmlFor="bk-name" className="text-sm text-ink">Full name</label>
                <Input
                  id="bk-name"
                  autoComplete="name"
                  placeholder="As it should appear on the ticket"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="bk-email" className="text-sm text-ink">Email</label>
                <Input
                  id="bk-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldClass}
                />
                <p className="text-xs text-muted-ink">Your ticket is sent here.</p>
              </div>
              {wantsPhone && (
                <div className="space-y-1.5">
                  <label htmlFor="bk-phone" className="text-sm text-ink">Phone number</label>
                  <Input
                    id="bk-phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="e.g. 0803 555 0117"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              )}
              {wantsTable && (
                <div className="space-y-1.5">
                  <label htmlFor="bk-table" className="text-sm text-ink">Table details</label>
                  <Input
                    id="bk-table"
                    placeholder={tableHint}
                    value={tableNote}
                    onChange={(e) => setTableNote(e.target.value)}
                    className={fieldClass}
                  />
                  {isTable && (
                    <p className="text-xs text-muted-ink">
                      The organizer confirms your table, and it arrives with your ticket email.
                    </p>
                  )}
                </div>
              )}
              {wantsDietary && (
                <div className="space-y-1.5">
                  <label htmlFor="bk-diet" className="text-sm text-ink">Dietary requirement</label>
                  <Input
                    id="bk-diet"
                    placeholder="Allergies or dietary needs"
                    value={dietaryNote}
                    onChange={(e) => setDietaryNote(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              )}

              {hasPromos && (
                pricing?.promoApplied ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-gold/40 bg-gold/5 px-3 py-2">
                    <span className="text-xs text-gold flex items-center gap-1.5 min-w-0">
                      <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {debouncedPromo.trim().toUpperCase()} applied. You save {naira(pricing.discountKobo)}.
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPromoCode("");
                        setDebouncedPromo("");
                        setPromoTouched(false);
                      }}
                      className="text-xs text-muted-ink hover:text-ink shrink-0"
                      aria-label="Remove promo code"
                    >
                      Remove
                    </button>
                  </div>
                ) : promoOpen ? (
                  <div className="space-y-1.5">
                    <label htmlFor="bk-promo" className="text-sm text-ink">Promo code</label>
                    <div className="relative">
                      <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-ink" aria-hidden="true" />
                      <Input
                        id="bk-promo"
                        autoFocus
                        placeholder="Code"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value.toUpperCase());
                          setPromoTouched(true);
                        }}
                        className={`${fieldClass} pl-10 uppercase`}
                      />
                    </div>
                    {promoFailed && (
                      <p className="text-xs text-red-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                        That code didn't apply. It may be expired or used up.
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPromoOpen(true)}
                    className="text-sm text-gold hover:text-gold-soft inline-flex items-center gap-1.5"
                  >
                    <Tag className="w-3.5 h-3.5" aria-hidden="true" />
                    Have a promo code?
                  </button>
                )
              )}
            </section>

            <section className="space-y-2 border-t border-hairline pt-4 text-sm" aria-label="Order summary">
              <div className="flex justify-between">
                <span className="text-muted-ink">
                  {pricing ? `${pricing.quantity} × ${pricing.ticketType}` : "Tickets"}
                </span>
                <span className="text-ink tabular-nums">{pricing ? naira(pricing.subtotalKobo) : "..."}</span>
              </div>
              {pricing && pricing.discountKobo > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-ink">Promo discount</span>
                  <span className="text-gold tabular-nums">-{naira(pricing.discountKobo)}</span>
                </div>
              )}
              {pricing && (pricing.serviceFeeKobo ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-ink">Service fee</span>
                  <span className="text-ink tabular-nums">{naira(pricing.serviceFeeKobo!)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2">
                <span className="font-medium text-ink">Total</span>
                <span className="font-display text-2xl font-bold text-ink tabular-nums">{totalLabel}</span>
              </div>
            </section>

            <div className="space-y-3 pb-1">
              <Button
                onClick={handleBooking}
                disabled={busy || quote.isLoading || !pricing}
                className="press w-full h-13 py-3.5 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-base rounded-md"
              >
                {busy ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : pricing && pricing.totalKobo === 0 ? (
                  <>
                    <Ticket className="w-5 h-5 mr-2" />
                    Get my free ticket
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    Pay {totalLabel}
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-ink">
                {pricing && pricing.totalKobo === 0
                  ? "No payment needed. Your QR ticket is issued instantly."
                  : "Card, bank transfer or USSD. Your QR ticket and PDF arrive by email."}
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
      <TicketReveal
        open={revealedTickets !== null}
        onClose={() => setRevealedTickets(null)}
        eventTitle={event.title}
        eventDate={event.date}
        location={event.location}
        email={email.trim() || (user?.email as string) || "your email"}
        tickets={revealedTickets ?? []}
        accentHex={(event as any).branding?.accentHex || null}
        logoUrl={(event as any).branding?.logoUrl || null}
        event={event}
      />
    </Dialog>
  );
}
