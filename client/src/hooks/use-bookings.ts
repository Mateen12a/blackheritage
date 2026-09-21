import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useMyBookings(email?: string) {
  return useQuery({
    queryKey: ["/api/bookings/search", email],
    queryFn: async () => {
      if (!email) return null;
      const res = await fetch(`/api/bookings/search?email=${encodeURIComponent(email)}`, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch bookings");
      const data = await res.json();
      return data;
    },
    enabled: !!email,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (bookingData: any) => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to create booking");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/search"] });
      toast({
        title: "Booking Confirmed!",
        description: "Your tickets have been reserved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export interface BookingQuoteResult {
  unitPriceKobo: number;
  quantity: number;
  subtotalKobo: number;
  discountKobo: number;
  totalKobo: number;
  available: number;
  promoApplied: boolean;
  promoMessage: string;
  ticketType: string;
}

/** Server-computed pricing. Debounced by the caller. */
export function useBookingQuote(eventId: string | null, tierName: string, quantity: number, promoCode: string) {
  return useQuery<BookingQuoteResult>({
    queryKey: ["/api/bookings/quote", eventId, tierName, quantity, promoCode.trim().toUpperCase()],
    queryFn: async () => {
      const res = await fetch("/api/bookings/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, tierName, quantity, promoCode: promoCode.trim().toUpperCase() || undefined }),
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Could not price that selection");
      }
      return res.json();
    },
    enabled: !!eventId && !!tierName && quantity > 0,
    retry: false,
    staleTime: 10_000,
  });
}

export interface BookingInitResult {
  bookingId: string;
  reference: string;
  totalKobo: number;
  paymentUrl: string | null;
  accessCode?: string;
  publicKey?: string | null;
  simulated?: boolean;
}

export function useInitiateBooking() {
  return useMutation({
    mutationFn: async (input: {
      eventId: string;
      tierName: string;
      quantity: number;
      name: string;
      email: string;
      promoCode?: string;
      tableNote?: string;
      phone?: string;
      dietaryNote?: string;
      guest?: boolean;
    }): Promise<BookingInitResult> => {
      const res = await fetch("/api/bookings/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Booking could not start");
      return body;
    },
  });
}

export interface FinalizeResult {
  bookingId: string;
  status: "paid";
  tickets: { code: string; tierName: string; attendeeName: string; seat: number }[];
}

export function useFinalizeBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reference: string): Promise<FinalizeResult> => {
      const res = await fetch("/api/bookings/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Payment could not be confirmed");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/search"] });
    },
  });
}

export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to initialize payment");
      return await res.json();
    },
  });
}
