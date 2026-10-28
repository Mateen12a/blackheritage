/**
 * One account's data must never show while another account is signed in.
 *
 * Queries are cached with staleTime: Infinity, so before this a login, logout
 * or account switch only replaced the auth/user entry: the previous account's
 * tickets, dashboard and wallet stayed on screen until a refresh. Every
 * identity change now goes through startSession/endSession, which wipe the
 * whole cache plus any account data kept on the device, and tell other open
 * tabs to do the same.
 *
 * A 401 while signed in means the session ended under us (expired, signed
 * out in another tab, password changed). That wipes the cache too and tells
 * the person to sign in again, with a button that brings them back here.
 */
import { queryClient, setUnauthorizedHandler } from "./queryClient";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

const BASE_URL = import.meta.env.VITE_API_URL || "";
export const AUTH_USER_KEY = [`${BASE_URL}/api/auth/user`];

// Account data the app keeps in the browser itself (the gate scanner's
// offline ticket list). Cleared with the cache on every identity change.
const DEVICE_KEYS = ["bh-verify-event", "bh-verify-cache"];

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("bh-session") : null;

const idOf = (u: any): string | null => (u ? String(u._id ?? u.id ?? "") || null : null);

// Everything except the auth entry itself: every screen observes that one,
// and removing it makes them see "unknown user" for a beat, which sent
// protected pages and the sign-in page redirecting into each other.
const notAuth = (q: { queryKey: readonly unknown[] }) => q.queryKey[0] !== AUTH_USER_KEY[0];

function wipe() {
  queryClient.cancelQueries({ predicate: notAuth });
  queryClient.removeQueries({ predicate: notAuth });
  for (const k of DEVICE_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      // storage blocked: nothing was kept there either
    }
  }
}

/** Signed in (login, register, account switch): drop everything, then seed the new user. */
export function startSession(user: any) {
  wipe();
  queryClient.setQueryData(AUTH_USER_KEY, user);
  channel?.postMessage({ type: "changed", userId: idOf(user) });
}

/** Signed out: drop everything and mark this tab as signed out. */
export function endSession() {
  wipe();
  queryClient.setQueryData(AUTH_USER_KEY, null);
  channel?.postMessage({ type: "changed", userId: null });
}

// Another tab signed in or out: this tab's cookie already belongs to that
// identity, so whatever this tab has cached is the wrong account's.
channel?.addEventListener("message", (e: MessageEvent) => {
  if (e.data?.type !== "changed") return;
  const current = idOf(queryClient.getQueryData(AUTH_USER_KEY));
  if (current === (e.data.userId ?? null)) return;
  wipe();
  queryClient.invalidateQueries({ queryKey: AUTH_USER_KEY });
});

// Coming back to a tab: confirm it is still the same person. Catches a switch
// made somewhere BroadcastChannel can't reach (another browser window type,
// a session that expired while the laptop slept).
let checking = false;
let lastCheck = 0;
async function confirmIdentity(force = false) {
  if (checking || document.visibilityState !== "visible") return;
  if (!force && Date.now() - lastCheck < 3000) return;
  lastCheck = Date.now();
  const cached = queryClient.getQueryData(AUTH_USER_KEY);
  if (cached === undefined) return; // nothing loaded yet
  checking = true;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/user`, { credentials: "include" });
    if (res.status >= 500) return; // server trouble is not a sign-out
    const fresh = res.ok ? await res.json() : null;
    if (idOf(fresh) === idOf(cached)) return;
    if (cached && !fresh) return sessionExpired();
    wipe();
    queryClient.setQueryData(AUTH_USER_KEY, fresh);
  } catch {
    // offline: keep what we have
  } finally {
    checking = false;
  }
}
document.addEventListener("visibilitychange", () => confirmIdentity(true));

// Many screens fetch on their own and quietly treat "not allowed" as empty,
// and much of the API answers a dead session with 403 rather than 401. So any
// 401/403 from our API triggers a quick "who am I" check: a real permission
// refusal changes nothing, a dead session gets the sign-in prompt.
const CREDENTIAL_ROUTES = /\/api\/auth\/(user|login|register|logout|forgot-password|reset-password)/;
if (typeof window !== "undefined" && !(window.fetch as any).__bhSession) {
  const nativeFetch = window.fetch.bind(window);
  const watched: typeof fetch = async (input, init) => {
    const res = await nativeFetch(input, init);
    if (res.status === 401 || res.status === 403) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const path = url.startsWith("http") ? new URL(url).pathname : url;
      if (path.startsWith(`${BASE_URL}/api/`.replace(/^https?:\/\/[^/]+/, "")) && !CREDENTIAL_ROUTES.test(path)) {
        void confirmIdentity();
      }
    }
    return res;
  };
  (watched as any).__bhSession = true;
  window.fetch = watched;

  // Cached pages make no request, so a dead session would go unnoticed while
  // someone clicks around. Each page change re-checks (throttled to 3s).
  // wouter announces its navigations as a "pushState" window event.
  window.addEventListener("pushState", () => void confirmIdentity());
  window.addEventListener("popstate", () => void confirmIdentity());
}

let notified = false;
function sessionExpired() {
  // Only someone who was signed in can lose a session. A signed-out visitor
  // hitting a members-only endpoint is not news.
  if (!queryClient.getQueryData(AUTH_USER_KEY)) return;
  endSession();
  if (notified) return;
  notified = true;
  setTimeout(() => (notified = false), 10_000);
  const here = window.location.pathname + window.location.search;
  const href = `/auth?returnTo=${encodeURIComponent(here)}`;
  toast({
    variant: "destructive",
    title: "You've been signed out",
    description: "Your session ended. Sign in again to pick up where you left off.",
    action: (
      <ToastAction altText="Sign in again" onClick={() => window.location.assign(href)}>
        Sign in
      </ToastAction>
    ),
  });
}

setUnauthorizedHandler(sessionExpired);
