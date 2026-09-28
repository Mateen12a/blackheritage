import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface AccountProfileInput {
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  socials?: {
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
    website?: string;
  };
}

export function useUpdateAccountProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: AccountProfileInput) => {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json() : null;
      if (!res.ok) throw new Error(data?.message || "Could not save your profile");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save profile", description: err.message, variant: "destructive" });
    },
  });
}

/**
 * Closes the signed-in account. The server keeps the transaction history and
 * scrubs the person, so this is not a favourite button: it demands the word
 * DELETE typed out, and the caller is signed out on success.
 */
export function useCloseAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (confirm: string) => {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm }),
      });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json() : null;
      if (!res.ok) {
        const err = new Error(data?.message || "Could not close your account") as Error & {
          events?: string[];
        };
        err.events = data?.events;
        throw err;
      }
      return data;
    },
    onSuccess: (data: any) => {
      // Everything cached belongs to an account that no longer exists.
      queryClient.clear();
      toast({ title: "Account closed", description: data?.message || "Sorry to see you go." });
    },
    onError: (err: Error & { events?: string[] }) => {
      toast({
        title: "Could not close the account",
        description: err.events?.length
          ? `${err.message} (${err.events.join(", ")})`
          : err.message,
        variant: "destructive",
      });
    },
  });
}

export function useChangePassword() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { currentPassword: string; newPassword: string }) => {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json() : null;
      if (!res.ok) throw new Error(data?.message || "Could not change your password");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Password updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not change password", description: err.message, variant: "destructive" });
    },
  });
}
