import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Same-origin API in dev/preview (vite proxies /api → localhost:3001);
// production can override with VITE_API_URL.
const BASE_URL = import.meta.env.VITE_API_URL || "";

export function useEvents() {
  return useQuery({
    queryKey: [`${BASE_URL}${api.events.list.path}`],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}${api.events.list.path}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      return api.events.list.responses[200].parse(data);
    },
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: [`${BASE_URL}${api.events.get.path}`, id],
    queryFn: async () => {
      const url = `${BASE_URL}${buildUrl(api.events.get.path, { id: id as any })}`;
      const res = await fetch(url, {
        credentials: "include"
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch event");
      const data = await res.json();
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (eventData: any) => {
      const res = await fetch(`${BASE_URL}${api.events.create.path}`, {
        method: api.events.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
        credentials: "include"
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.events.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create event");
      }
      return api.events.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${BASE_URL}${api.events.list.path}`] });
      toast({
        title: "Success",
        description: "Event created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
