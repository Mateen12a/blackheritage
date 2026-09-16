import { useQuery } from "@tanstack/react-query";

const BASE_URL = import.meta.env.VITE_API_URL || "";

export function useManagedEvents() {
  return useQuery<any[]>({
    queryKey: [`${BASE_URL}/api/events`, "manage"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/events?manage=true`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });
}
