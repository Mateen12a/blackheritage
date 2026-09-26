import { ApiError } from "./errors";

/** True for a signed-out request, whether it came from the API layer or a raw throw. */
export function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 401;
  return /^401/.test(String((error as Error)?.message || ""));
}

// Redirect to login with a toast notification
export function redirectToLogin(toast?: (options: { title: string; description: string; variant: string }) => void) {
  if (toast) {
    toast({
      title: "Sign in needed",
      description: "Your session ended. Signing you back in...",
      variant: "destructive",
    });
  }
  setTimeout(() => {
    window.location.href = "/api/login";
  }, 500);
}
