import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useMyBookings() {
  return useQuery({
    queryKey: [api.bookings.listMine.path],
    queryFn: async () => {
      const res = await fetch(api.bookings.listMine.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch bookings");
      const data = await res.json();
      return data;
    },
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
      queryClient.invalidateQueries({ queryKey: [api.bookings.listMine.path] });
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
