import { useQuery } from "@tanstack/react-query";

export interface EventPulse {
  going: number;
  soldToday: number;
  recent: { name: string; ago: string; qty: number }[];
}

/**
 * Live, anonymized sales pulse for one event. Only first names and counts
 * leave the server. The organizer controls whether any of it renders via
 * showAttendeeCount; the endpoint itself reveals nothing beyond first names.
 */
export function useEventPulse(eventId?: string, enabled = true) {
  return useQuery<EventPulse>({
    queryKey: ["pulse", eventId],
    enabled: !!eventId && enabled,
    refetchInterval: 30000,
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/pulse`);
      if (!res.ok) throw new Error("pulse unavailable");
      return res.json();
    },
  });
}
