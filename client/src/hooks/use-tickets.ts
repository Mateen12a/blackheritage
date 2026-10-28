import { useQuery } from "@tanstack/react-query";

export interface TicketView {
  id: string;
  code: string;
  tierName: string;
  seat: number;
  attendeeName: string;
  amountPaid: number;
  status: "valid" | "used" | "void";
}

// `ref` is the booking reference from the ticket email. Signed-in owners don't
// need it; a guest who found their booking by reference proves it with it.
const refQuery = (ref?: string | null) => (ref ? `?ref=${encodeURIComponent(ref)}` : "");

export function useBookingTickets(bookingId: string | null, ref?: string | null) {
  return useQuery<TicketView[]>({
    queryKey: ["/api/bookings", bookingId, "tickets"],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}/tickets${refQuery(ref)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Could not load tickets");
      return res.json();
    },
    enabled: !!bookingId,
  });
}

export function bookingPdfUrl(bookingId: string, ref?: string | null): string {
  return `/api/bookings/${bookingId}/pdf${refQuery(ref)}`;
}
