import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

// Same-origin API in dev/preview (vite proxy targets localhost:3001);
// production can override with VITE_API_URL.
const BASE_URL = import.meta.env.VITE_API_URL || "";

export function useVendors() {
  return useQuery({
    queryKey: [`${BASE_URL}${api.vendors.list.path}`],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}${api.vendors.list.path}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch vendors");
      const data = await res.json();
      return api.vendors.list.responses[200].parse(data);
    },
  });
}

export function useMyVendors(enabled: boolean) {
  return useQuery({
    queryKey: [`${BASE_URL}${api.vendors.list.path}`, "mine"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}${api.vendors.list.path}?mine=true`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch your vendor profile");
      const data = await res.json();
      return api.vendors.list.responses[200].parse(data);
    },
    enabled,
  });
}

export function useVendor(id: string) {
  return useQuery({
    queryKey: [`${BASE_URL}${api.vendors.get.path}`, id],
    queryFn: async () => {
      // /v/:slug pages pass the slug; the id route passes a raw id. Both hit
      // the same payload shape; the slug endpoint resolves aliases too.
      const isSlug = !/^[0-9a-fA-F]{24}$/.test(id) && !/^vendor-/.test(id);
      const url = isSlug
        ? `${BASE_URL}/api/vendors/by-slug/${encodeURIComponent(id)}`
        : `${BASE_URL}${buildUrl(api.vendors.get.path, { id: id as any })}`;
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch vendor");
      const data = await res.json();
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (vendorData: any) => {
      const res = await fetch(`${BASE_URL}${api.vendors.create.path}`, {
        method: api.vendors.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vendorData),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.vendors.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create vendor profile");
      }
      return api.vendors.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${BASE_URL}${api.vendors.list.path}`] });
      toast({
        title: "Success",
        description: "Vendor profile created successfully",
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

export function useUpdateVendor(id: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (vendorData: any) => {
      const res = await fetch(`${BASE_URL}${buildUrl(api.vendors.update.path, { id: id as any })}`, {
        method: api.vendors.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vendorData),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.vendors.update.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to update vendor profile");
      }
      return api.vendors.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${BASE_URL}${api.vendors.list.path}`] });
      queryClient.invalidateQueries({ queryKey: [`${BASE_URL}${api.vendors.get.path}`, id] });
      toast({
        title: "Success",
        description: "Vendor profile updated successfully",
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
