import type { Express } from "express";
import bcrypt from "bcryptjs";
import { User } from "./models";

/**
 * Google OAuth routes.
 *
 * To enable Google sign-in, set these environment variables:
 *   GOOGLE_CLIENT_ID     : from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET : from Google Cloud Console
 *
 * The callback URL is: {BASE_URL}/api/auth/google/callback
 *
 * When the env vars are not set, the endpoints return a helpful error
 * instead of crashing.
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL =
  process.env.BACKEND_URL ||
  process.env.VITE_API_URL ||
  "http://localhost:3001";

function isConfigured() {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

/**
 * Frontend origin to redirect back to after sign-in. FRONTEND_URL wins
 * (production). Outside production it defaults to the Vite dev server on
 * port 5000, which proxies /api to this backend. Empty string means a
 * relative redirect for same-origin deployments where the backend serves
 * the built client.
 */
function frontendOrigin(): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:5000";
  return "";
}

function safeDestination(dest: unknown): string {
  if (typeof dest === "string" && /^\/[^/]/.test(dest)) return dest;
  return "/dashboard";
}

// Simple state store for CSRF protection (in-memory, single-instance)
const pendingStates = new Map<string, { returnTo: string; timestamp: number }>();

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

    const state = generateState();
    const redirectUri = `${BASE_URL}/api/auth/google/callback`;
    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "";

    // Store state with a 10-minute expiry
    pendingStates.set(state, { returnTo, timestamp: Date.now() });

    // Clean old states
    Array.from(pendingStates.entries()).forEach(([key, val]) => {
      if (Date.now() - val.timestamp > 10 * 60 * 1000) {
        pendingStates.delete(key);
      }
    });

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });

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

    const returnTo = pendingStates.get(state)?.returnTo;
    pendingStates.delete(state);

    try {
      // Exchange authorization code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${BASE_URL}/api/auth/google/callback`,
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

      // Find or create user
      let user = await User.findOne({ email: profile.email });

      if (!user) {
        // Create new account from Google profile
        const randomPassword = await bcrypt.hash(
          Math.random().toString(36).slice(2),
          10
        );
        user = new User({
          username: profile.name || profile.email.split("@")[0],
          email: profile.email,
          password: randomPassword,
          role: "user", // Default to attendee; they can upgrade later
        });
        await user.save();
      }

      // Log in via passport session
      req.login(user, (err) => {
        if (err) {
          console.error("Google auth login failed:", err);
          return res.redirect("/auth?error=session_failed");
        }
        // Redirect to the appropriate dashboard on the frontend origin
        const role = (user as any).role;
        const dest = safeDestination(
          returnTo ||
            (role === "admin" || role === "organizer" ? "/admin" : "/dashboard")
        );
        res.redirect(`${frontendOrigin()}${dest}`);
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
