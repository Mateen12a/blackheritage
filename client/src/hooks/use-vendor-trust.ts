import { useQuery } from "@tanstack/react-query";

export interface VendorTrust {
  memberSince: string | null;
  completedBookings: number;
  /** Median hours to reply over the last 30 days; null until they have. */
  responseHours: number | null;
}

/**
 * Earned signals for a vendor profile: how long they have been on the
 * platform, what they have completed, and how fast they actually reply.
 * Nothing here is self-reported.
 */
export function useVendorTrust(vendorId?: string) {
  return useQuery<VendorTrust>({
    queryKey: ["vendor-trust", vendorId],
    enabled: !!vendorId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(`/api/vendors/${vendorId}/trust`);
      if (!res.ok) throw new Error("trust unavailable");
      return res.json();
    },
  });
}
