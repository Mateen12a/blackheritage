import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface VendorRatingSummary {
  count: number;
  average: number | null;
  recent: { id: string; name: string; stars: number; comment: string | null; createdAt: string }[];
}

export function useVendorRatings(vendorId: string | undefined) {
  return useQuery<VendorRatingSummary>({
    queryKey: ["/api/vendors", vendorId, "ratings"],
    enabled: !!vendorId,
    queryFn: async () => {
      const res = await fetch(`/api/vendors/${vendorId}/ratings`);
      if (!res.ok) return { count: 0, average: null, recent: [] };
      return res.json();
    },
  });
}

export function useReviewVendor(vendorId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { stars: number; comment?: string }) => {
      const res = await fetch(`/api/vendors/${vendorId}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Could not post your review");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", vendorId, "ratings"] });
      toast({ title: "Review posted" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not post review", description: err.message, variant: "destructive" });
    },
  });
}
