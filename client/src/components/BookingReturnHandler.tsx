import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useFinalizeBooking } from "@/hooks/use-bookings";
import { TicketReveal, type RevealTicket } from "@/components/TicketReveal";

/**
 * The landing spot for a hosted-checkout redirect (Flutterwave sends the buyer
 * back to the event page with ?ref=<booking reference>&status=...).
 *
 * The gateway's redirect is never trusted as proof of payment: the handler
 * calls the same server finalize endpoint the inline path uses, which verifies
 * the transaction with the gateway before issuing tickets. Idempotent, so a
 * webhook that beats the buyer home is harmless.
 *
 * Renders nothing while idle; only exists while a ?ref= is in the URL.
 */
export function BookingReturnHandler({ event }: { event: any }) {
  const finalize = useFinalizeBooking();
  const [revealed, setRevealed] = useState<RevealTicket[] | null>(null);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("ref");
    if (!reference || started.current) return;
    started.current = true;

    finalize.mutate(reference, {
      onSuccess: async (result) => {
        // Tier counts changed; refresh whatever is cached.
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        setRevealed(result.tickets);
      },
      onError: () => setFailed(true),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean the URL once handled so a refresh or share does not re-trigger.
  useEffect(() => {
    if (revealed === null && !failed) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("ref");
    url.searchParams.delete("status");
    url.searchParams.delete("gateway");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [revealed, failed]);

  if (revealed === null && !failed) return null;

  if (failed) {
    return (
      <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/90 backdrop-blur-sm px-4">
        <div className="bg-surface-2 border border-hairline rounded-2xl p-6 max-w-sm text-center space-y-3">
          <p className="font-display text-lg text-ink">Payment landed, confirmation pending</p>
          <p className="text-sm text-muted-ink">
            We verify every payment with the gateway before tickets are issued. Check My Tickets in a
            minute; if nothing appears, contact support with your payment reference.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TicketReveal
      open={revealed !== null}
      onClose={() => setRevealed(null)}
      eventTitle={event?.title || "Your booking"}
      eventDate={event?.date || new Date()}
      location={event?.location || ""}
      email={revealed?.[0]?.attendeeName || "your email"}
      tickets={revealed ?? []}
      accentHex={event?.branding?.accentHex || null}
      logoUrl={event?.branding?.logoUrl || null}
      event={event}
    />
  );
}
