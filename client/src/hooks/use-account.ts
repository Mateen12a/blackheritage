import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export interface BankItem {
  code: string;
  name: string;
}

export function useBanks() {
  return useQuery<BankItem[]>({
    queryKey: ["/api/banks"],
    queryFn: async () => {
      const res = await fetch("/api/banks", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load banks");
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export interface BankAccountInput {
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: BankAccountInput) => {
      const res = await fetch("/api/account/bank", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json() : null;
      if (!res.ok) throw new Error(data?.message || "Could not link your settlement bank account");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizers/me/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/setup-checklist"] });
      toast({
        title: "Settlement account linked",
        description: "Your bank details have been saved for automated payouts.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Bank linking failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

export interface VerificationInput {
  businessName: string;
  bvnLast4?: string;
  cacNumber?: string;
  idType?: string;
  idNumber?: string;
  phone: string;
}

export function useSubmitVerification() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: VerificationInput) => {
      const res = await fetch("/api/account/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json() : null;
      if (!res.ok) throw new Error(data?.message || "Could not submit verification");
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizers/me/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/setup-checklist"] });
      toast({
        title: data?.isVerified ? "Account verified" : "Verification submitted",
        description: data?.isVerified
          ? "Your organizer account is now verified for automated payouts!"
          : "Your details are under review. We'll verify your credentials shortly.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Verification submission failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

export function useAdminVerifyOrganizer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, verified, notes }: { id: string; verified: boolean; notes?: string }) => {
      const res = await fetch(`/api/admin/organizers/${id}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ verified, notes }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Failed to update verification status");
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payouts"] });
      toast({
        title: vars.verified ? "Organizer verified" : "Verification rejected",
        description: vars.verified ? "Organizer payouts and subaccount split unlocked." : "Status updated.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    },
  });
}
