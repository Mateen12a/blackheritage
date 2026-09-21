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

export function useBookingTickets(bookingId: string | null) {
  return useQuery<TicketView[]>({
    queryKey: ["/api/bookings", bookingId, "tickets"],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}/tickets`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Could not load tickets");
      return res.json();
    },
    enabled: !!bookingId,
  });
}

export function bookingPdfUrl(bookingId: string): string {
  return `/api/bookings/${bookingId}/pdf`;
}
