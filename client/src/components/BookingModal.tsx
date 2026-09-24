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
import React, { useState, useEffect } from "react";
import {
  useBookingQuote,
  useInitiateBooking,
  useFinalizeBooking,
} from "@/hooks/use-bookings";
import { Loader2, CreditCard, Users, Tag, Check, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { TicketReveal, type RevealTicket } from "@/components/TicketReveal";

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

      // Dev mode: no gateway keys on the server, so the booking confirms
      // immediately against the simulated gateway.
      if (init.simulated || !init.paymentUrl) {
        const result = await finalize(init.reference);
        showSuccess(result);
        return;
      }

      // Flutterwave: hosted checkout redirects the whole tab through the
      // gateway and back to this page with ?ref=... The return handler shows
      // the reveal there, so here we just send the buyer off. More reliable
      // than popups on Nigerian mobile browsers.
      if (init.gateway === "flutterwave") {
        window.location.href = init.paymentUrl;
        return;
      }

      // Real gateway: open Paystack's hosted page in a popup, then verify
      // the reference server-side. The popup response is never trusted.
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const paystackKey = init.publicKey || import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      const PaystackPop = window.PaystackPop;
      if (!paystackKey || !PaystackPop) {
        toast({
          variant: "destructive",
          title: "Payment window could not open",
          description: "Disable your popup blocker for this site and try again.",
        });
        return;
      }
      const handler = PaystackPop.setup({
        key: paystackKey,
        email: email.trim(),
        amount: init.totalKobo,
        currency: "NGN",
        reference: init.reference,
        metadata: {
          booking_id: init.bookingId,
          custom_fields: [
            { display_name: "Ticket Type", variable_name: "ticket_type", value: selectedTier },
          ],
        },
        // Paystack's current inline API uses onSuccess/onCancel. The legacy
        // callback/onClose names make inline.js throw "Attribute callback
        // must be a valid function".
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
      });
      handler.openIframe();
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
          <div className="p-6 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-display font-bold text-ink">
                Buy Your Ticket
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-ink">
                {event.title}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              <div className="space-y-3">
                <label className="eyebrow">Select Ticket Type</label>
                <div className="grid grid-cols-1 gap-2">
                  {ticketTypes.map((type: any) => {
                    const remaining = Math.max(0, Number(type.capacity || 0) - Number(type.sold || 0));
                    const saleClosed = type.saleClose && new Date(type.saleClose).getTime() < Date.now();
                    const soldOut = remaining <= 0;
                    return (
                      <button
                        key={type.name}
                        onClick={() => setSelectedTier(type.name)}
                        disabled={soldOut || saleClosed}
                        className={`p-4 rounded-md border text-left transition-colors ${
                          selectedTier === type.name
                            ? "border-gold bg-surface-2"
                            : "border-hairline bg-surface-2/50 hover:border-white/30"
                        } ${soldOut || saleClosed ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex justify-between items-baseline">
                          <span className="font-medium text-ink">{type.name}</span>
                          <span className="font-display font-bold text-gold">
                            {type.price === 0 ? "Free" : naira(type.price)}
                          </span>
                        </div>
                        <div className="eyebrow mt-1">
                          {soldOut
                            ? "Sold out"
                            : saleClosed
                              ? "Sales closed"
                              : showCounts
                                ? `${remaining.toLocaleString()} available`
                                : "On sale now"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="eyebrow">Your Full Name</label>
                  <Input
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 bg-surface-2 border-hairline focus-visible:border-gold focus-visible:ring-0 text-ink rounded-md px-4 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <label className="eyebrow">Email Address</label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 bg-surface-2 border-hairline focus-visible:border-gold focus-visible:ring-0 text-ink rounded-md px-4 text-base"
                  />
                  <p className="text-xs text-muted-ink">
                    Your ticket will be sent to this email
                  </p>
                </div>
                {wantsPhone && (
                  <div className="space-y-2">
                    <label className="eyebrow">Phone Number</label>
                    <Input
                      type="tel"
                      placeholder="e.g. 0803 555 0117"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-12 bg-surface-2 border-hairline focus-visible:border-gold focus-visible:ring-0 text-ink rounded-md px-4 text-base"
                    />
                  </div>
                )}
                {wantsTable && (
                  <div className="space-y-2">
                    <label className="eyebrow">Table Details</label>
                    <Input
                      placeholder={tableHint}
                      value={tableNote}
                      onChange={(e) => setTableNote(e.target.value)}
                      className="h-12 bg-surface-2 border-hairline focus-visible:border-gold focus-visible:ring-0 text-ink rounded-md px-4 text-base"
                    />
                    {isTable && (
                      <p className="text-xs text-muted-ink">
                        Your table assignment is confirmed by the organizer and
                        arrives with your ticket email.
                      </p>
                    )}
                  </div>
                )}
                {wantsDietary && (
                  <div className="space-y-2">
                    <label className="eyebrow">Dietary Requirement</label>
                    <Input
                      placeholder="Allergies or dietary needs"
                      value={dietaryNote}
                      onChange={(e) => setDietaryNote(e.target.value)}
                      className="h-12 bg-surface-2 border-hairline focus-visible:border-gold focus-visible:ring-0 text-ink rounded-md px-4 text-base"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="eyebrow">Number of Tickets</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="h-12 bg-surface-2 border-hairline focus-visible:border-gold focus-visible:ring-0 text-ink rounded-md px-4 text-base"
                />
              </div>

              <div className="space-y-2">
                <label className="eyebrow">Promo Code</label>
                <div className="relative">
                  <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-ink" aria-hidden="true" />
                  <Input
                    placeholder="Enter code if you have one"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase());
                      setPromoTouched(true);
                    }}
                    className="h-12 pl-10 bg-surface-2 border-hairline focus-visible:border-gold focus-visible:ring-0 text-ink rounded-md px-4 text-base uppercase"
                  />
                </div>
                {pricing?.promoApplied ? (
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
                ) : promoFailed && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                    That code didn't apply. It may be expired or used up.
                  </p>
                )}
              </div>

              <div className="bg-surface-2 rounded-md p-4 sm:p-6 space-y-3 border border-hairline">
                {showCounts && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="eyebrow text-gold">Availability</span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-ink">
                      <Users className="w-3 h-3 text-gold" aria-hidden="true" />
                      {pricing
                        ? `${pricing.available.toLocaleString()} left in ${pricing.ticketType}`
                        : "Checking..."}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-ink">
                    {pricing ? `${pricing.ticketType} x ${pricing.quantity}` : "Price"}
                  </span>
                  <span className="font-medium text-ink">
                    {pricing ? naira(pricing.subtotalKobo) : "..."}
                  </span>
                </div>
                {pricing && pricing.discountKobo > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-ink">Promo discount</span>
                    <span className="font-medium text-gold">-{naira(pricing.discountKobo)}</span>
                  </div>
                )}
                <div className="border-t border-hairline my-4 pt-4 flex justify-between items-baseline">
                  <span className="eyebrow">Total</span>
                  <span className="font-display text-2xl font-bold text-gold">{totalLabel}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleBooking}
                  disabled={busy || quote.isLoading || !pricing}
                  className="press w-full h-14 bg-primary text-primary-foreground hover:bg-gold-soft font-medium text-lg rounded-md"
                >
                  {busy ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2.5" />
                      {pricing && pricing.totalKobo === 0 ? "Confirm Free Ticket" : `Pay ${totalLabel}`}
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-ink leading-relaxed pb-2">
                Pay safely with card, bank transfer, or USSD.
                <br />
                Your coded ticket is issued the moment payment clears, and a PDF copy goes to your email.
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
