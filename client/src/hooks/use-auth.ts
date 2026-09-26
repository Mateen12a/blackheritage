import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { errorFromResponse } from "@/lib/errors";

// Same-origin API in dev/preview (vite proxies /api → localhost:3001);
// production can override with VITE_API_URL.
const BASE_URL = import.meta.env.VITE_API_URL || "";

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<any>({
    queryKey: [`${BASE_URL}/api/auth/user`],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/auth/user`, {
        credentials: "include"
      });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: any) => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include"
      });
      if (!res.ok) {
        // errorFromResponse copes with a JSON body, a plain-text one, or an
        // empty one, and never surfaces a parse error to the user.
        throw await errorFromResponse(res);
      }
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData([`${BASE_URL}/api/auth/user`], user);
    }
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: any) => {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include"
      });
      if (!res.ok) {
        throw await errorFromResponse(res);
      }
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData([`${BASE_URL}/api/auth/user`], user);
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch(`${BASE_URL}/api/auth/logout`, { 
        method: "POST",
        credentials: "include"
      });
    },
    onSuccess: () => {
      queryClient.setQueryData([`${BASE_URL}/api/auth/user`], null);
    }
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isSigningIn: loginMutation.isPending || registerMutation.isPending,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync
  };
}
