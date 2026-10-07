/**
 * Google OAuth routes.
 *
 * To enable Google sign-in, set these environment variables in .env:
 *   GOOGLE_CLIENT_ID     : from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET : from Google Cloud Console
 *   BASE_URL             : production domain (e.g. https://blackhevents.com)
 *
 * The callback URL is: {BASE_URL}/api/auth/google/callback
 *
 * Localhost requests route the OAuth round-trip through
 * http://localhost:3001 (the registered dev redirect URI) and land back on
 * http://localhost:5000; everything else uses the production domain.
 */
import type { Express, Request } from "express";
import bcrypt from "bcryptjs";
import { User } from "./models";
import { generateReferralCode } from "./referrals";

function getGoogleCredentials() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim(),
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
  };
}

function isConfigured() {
  const { clientId, clientSecret } = getGoogleCredentials();
  return Boolean(clientId && clientSecret);
}

function getRedirectUri(req: Request): string {
  const host = req.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  if (isLocal) {
    return "http://localhost:3001/api/auth/google/callback";
  }
  const base =
    process.env.BASE_URL ||
    process.env.BACKEND_URL ||
    process.env.VITE_API_URL ||
    "https://blackhevents.com";
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}

function safeDestination(dest: unknown): string {
  if (typeof dest === "string" && /^\/[^/]/.test(dest)) return dest;
  return "/dashboard";
}

// Simple state store for CSRF protection (in-memory, single-instance)
interface OAuthState {
  returnTo: string;
  redirectUri: string;
  audience: string;
  founderVoucher?: string;
  timestamp: number;
}
const pendingStates = new Map<string, OAuthState>();

function generateState() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function setupGoogleAuth(app: Express) {
  // Step 1: Build the Google OAuth consent URL and redirect
  app.get("/api/auth/google", (req, res) => {
    if (!isConfigured()) {
      return res.status(503).json({
        message:
          "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment.",
      });
    }

    const { clientId } = getGoogleCredentials();
    const state = generateState();
    const redirectUri = getRedirectUri(req);
    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "";
    // Which signup card started this flow. Fall back to role param if audience is absent.
    const rawAudience = typeof req.query.audience === "string" ? req.query.audience : typeof req.query.role === "string" ? req.query.role : "";
    const audience = rawAudience === "organizer" || (returnTo && returnTo.startsWith("/admin")) ? "organizer" : rawAudience;
    const rawVoucher = typeof req.query.founderVoucher === "string" ? req.query.founderVoucher : typeof req.query.promo === "string" ? req.query.promo : "";
    const founderVoucher = rawVoucher.trim().toUpperCase() === "FOUNDER100" || (audience === "organizer" && rawVoucher !== "NONE") ? "FOUNDER100" : undefined;
    const role = audience === "organizer" ? "organizer" : "user";

    // Store state and redirectUri with a 10-minute expiry
    pendingStates.set(state, { returnTo, redirectUri, audience, founderVoucher, timestamp: Date.now() });

    // Clean old states
    Array.from(pendingStates.entries()).forEach(([key, val]) => {
      if (Date.now() - val.timestamp > 10 * 60 * 1000) {
        pendingStates.delete(key);
      }
    });

    const params = new URLSearchParams({
      client_id: clientId!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
    });
    // No hardcoded `prompt`: forcing select_account re-shows Google's account
    // and consent screens on every sign-in. Returning users who already
    // consented now flow straight back to the callback. Passing
    // ?prompt=select_account on this endpoint opts back into the picker for
    // "switch Google account" links.

    res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );
  });

  // Step 2: Handle the callback: exchange code for tokens, fetch profile, create/find user, log in
  app.get("/api/auth/google/callback", async (req, res) => {
    if (!isConfigured()) {
      return res.redirect("/auth?error=google_not_configured");
    }

    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      return res.redirect(`/auth?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state || !pendingStates.has(state)) {
      return res.redirect("/auth?error=invalid_state");
    }

    const pending = pendingStates.get(state);
    const returnTo = pending?.returnTo;
    const redirectUri = pending?.redirectUri || getRedirectUri(req);
    const role = pending?.audience === "organizer" ? "organizer" : "user";
    pendingStates.delete(state);

    const { clientId, clientSecret } = getGoogleCredentials();

    try {
      // Exchange authorization code for tokens using the EXACT same redirect_uri
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId!,
          client_secret: clientSecret!,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        console.error("Google token exchange failed:", tokenData);
        return res.redirect("/auth?error=token_exchange_failed");
      }

      // Fetch user profile from Google
      const profileRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }
      );

      const profile = await profileRes.json();

      if (!profile.email) {
        return res.redirect("/auth?error=no_email");
      }

      // Find or create user. A closed account keeps a tombstone row for the
      // transaction history and never a login: signing in again starts fresh.
      let user = await User.findOne({ email: profile.email.toLowerCase().trim() });
      if (user && (user as any).deletedAt) user = null;
      const isNewUser = !user;

      // Existing attendee upgrade: if a registered attendee signs in through
      // the organizer flow, elevate them to organizer immediately.
      if (user && pending?.audience === "organizer" && (user as any).role === "user") {
        (user as any).role = "organizer";
        if (pending?.founderVoucher && !(user as any).founderVoucher) {
          (user as any).founderVoucher = pending.founderVoucher;
          (user as any).waivedTicketCount = 0;
        }
        await user.save();
      }

      if (!user) {
        // Create collision-safe username
        const baseUsername = (profile.name || profile.email.split("@")[0])
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 20) || "user";

        let candidateUsername = baseUsername;
        let suffix = 1;
        while (await User.findOne({ username: candidateUsername })) {
          candidateUsername = `${baseUsername.slice(0, 14)}_${suffix++}`;
        }

        const randomPassword = await bcrypt.hash(
          Math.random().toString(36).slice(2) + Date.now().toString(36),
          10
        );

        user = new User({
          username: candidateUsername,
          email: profile.email.toLowerCase().trim(),
          password: randomPassword,
          role, // organizer card creates an organizer; everyone else is an attendee
          displayName: profile.name || undefined,
          avatarUrl: profile.picture || undefined,
          referralCode: generateReferralCode(),
          termsAcceptedAt: new Date(),
          ...(role === "organizer" && pending?.founderVoucher
            ? { founderVoucher: pending.founderVoucher, waivedTicketCount: 0 }
            : {}),
        });
        await user.save();
        // Match the password signup path: the audience decides the variant:
        // organizers get next-steps, talent get profile-setup guidance,
        // attendees get discovery. Fire-and-forget: the redirect never waits.
        const emailRole: "user" | "organizer" | "vendor" =
          role === "organizer" ? "organizer" : pending?.audience === "vendor" ? "vendor" : "user";
        if (process.env.RESEND_API_KEY) {
          import("./emails")
            .then(({ sendWelcomeEmail }) =>
              sendWelcomeEmail(
                { name: String(profile.name || candidateUsername), email: String(user!.email) },
                emailRole,
              ),
            )
            .catch((e) => console.error("Welcome email failed:", e));
        }
      }

      // Log in via passport session
      req.login(user, (err) => {
        if (err) {
          console.error("Google auth login failed:", err);
          return res.redirect("/auth?error=session_failed");
        }
        // Redirect to the appropriate destination on the correct frontend.
        // If an explicit returnTo matches the account's capability (e.g. /admin/events/new
        // for an organizer), prioritize it over landing on the root dashboard.
        const userRole = (user as any).role;
        const dest = safeDestination(
          isNewUser
            ? userRole === "organizer"
              ? (returnTo && returnTo.startsWith("/admin") ? returnTo : "/admin")
              : pending?.audience === "vendor"
                ? "/vendor-dashboard"
                : (returnTo && !returnTo.startsWith("/admin") ? returnTo : "/dashboard")
            : returnTo ||
              (userRole === "admin" || userRole === "organizer"
                ? "/admin"
                : "/dashboard")
        );
        const isLocal = redirectUri.includes("localhost");
        const frontendBase = isLocal
          ? "http://localhost:5000"
          : (process.env.FRONTEND_URL?.replace(/\/$/, "") || "");
        res.redirect(`${frontendBase}${dest}`);
      });
    } catch (err) {
      console.error("Google OAuth error:", err);
      return res.redirect("/auth?error=oauth_error");
    }
  });

  // Status endpoint so the frontend can check if Google sign-in is available
  app.get("/api/auth/google/status", (_req, res) => {
    res.json({ configured: isConfigured() });
  });
}

