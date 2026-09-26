import { useState, useEffect, FormEvent } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useEvents } from "@/hooks/use-events";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Ticket,
  CalendarDays,
  Store,
  Check,
  ArrowUpRight,
  ShieldCheck,
  Gift,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { EMAIL_HINT, isValidEmail } from "@shared/email";
import { errorMessage } from "@/lib/errors";
import type { Event } from "@shared/schema";
import logoImg from "../assets/logo.png";

type Mode = "login" | "register";
type Audience = "attendee" | "organizer" | "vendor";

type FieldName =
  | "username"
  | "email"
  | "password"
  | "confirmPassword"
  | "terms";
type FieldErrors = Partial<Record<FieldName, string>>;

/** Inline error under a field. Toasts disappear; this stays where the fix is. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {message}
    </p>
  );
}

const AUDIENCES: {
  key: Audience;
  icon: typeof Ticket;
  label: string;
  benefit: string;
  cta: string;
  success: string;
}[] = [
  {
    key: "attendee",
    icon: Ticket,
    label: "I'm here for the events",
    benefit: "Stop guessing which event is worth your night.",
    cta: "Start Exploring",
    success: "You're in. Your tickets and saved events are ready.",
  },
  {
    key: "organizer",
    icon: CalendarDays,
    label: "I run events",
    benefit: "Sell tickets like a professional operation, without building one.",
    cta: "Start Selling Tickets",
    success: "Welcome! Your dashboard is ready.",
  },
  {
    key: "vendor",
    icon: Store,
    label: "I'm a vendor or entertainer",
    benefit: "Get booked on your work, not just who knows you.",
    cta: "List My Business",
    success: "Account created. Let's set up your vendor profile.",
  },
];


function safeReturnTo(search: string): string | null {
  const returnTo = new URLSearchParams(search).get("returnTo");
  return returnTo &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//")
    ? returnTo
    : null;
}

const BASE_URL = import.meta.env.VITE_API_URL || "";

/** Sparse rising golden embers for the brand panel, evoking a live Lagos concert stage. */
const PANEL_EMBERS = [
  { left: "10%", bottom: "16%", size: 4, delay: "0.5s", duration: "10s", drift: "16px" },
  { left: "28%", bottom: "24%", size: 3, delay: "2.8s", duration: "11s", drift: "-14px" },
  { left: "52%", bottom: "12%", size: 5, delay: "4.5s", duration: "9s", drift: "20px" },
  { left: "74%", bottom: "20%", size: 3, delay: "1.5s", duration: "12s", drift: "-18px" },
  { left: "88%", bottom: "14%", size: 4, delay: "6.2s", duration: "10s", drift: "15px" },
];
export default function AuthPage() {
  const [, setLocation] = useLocation();
  const rawSearch = useSearch();
  const queryString = rawSearch.startsWith("?")
    ? rawSearch.slice(1)
    : rawSearch;
  const returnTo = safeReturnTo(queryString);

  const [modeOverride, setModeOverride] = useState<Mode | null>(null);
  const mode: Mode =
    modeOverride ?? (queryString.includes("tab=register") ? "register" : "login");
  const setMode = (m: Mode) => setModeOverride(m);
  // Referral: /r/CODE lands here with ?ref=CODE. The code rides along to the
  // server with the registration, which attributes the invite.
  const referralCode = (
    new URLSearchParams(queryString).get("ref") || ""
  )
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
  const [audience, setAudience] = useState<Audience>("attendee");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { login, register } = useAuth();
  const { toast } = useToast();
  const { data: events } = useEvents();

  // Surface OAuth failures Google bounces back with ?error=...
  useEffect(() => {
    const oauthError = new URLSearchParams(queryString).get("error");
    if (!oauthError) return;
    const messages: Record<string, string> = {
      google_not_configured: "Google sign-in is not set up yet. Use email sign-in for now.",
      invalid_state: "That sign-in link expired. Start Google sign-in again.",
      token_exchange_failed: "Google rejected the sign-in. Try again in a moment.",
      session_failed: "Sign-in finished but the session did not start. Try again.",
      no_email: "Your Google account did not share an email, so sign-in stopped.",
      access_denied: "Google sign-in was cancelled.",
      oauth_error: "Google sign-in hit an error. Try again or use email.",
    };
    toast({
      variant: "destructive",
      title: "Google sign-in didn't complete",
      description: messages[oauthError] || "Something went wrong. Email sign-in always works.",
    });
  }, []);

  const isRegister = mode === "register";
  const activeAudience = AUDIENCES.find((a) => a.key === audience)!;

  // Auto-rotating live showcase of real Lagos events
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const [isEventPaused, setIsEventPaused] = useState(false);
  const featuredEvents = (events ?? []).slice(0, 4);

  useEffect(() => {
    if (isEventPaused || featuredEvents.length <= 1) return;
    const timer = setInterval(() => {
      setActiveEventIndex((prev) => (prev + 1) % featuredEvents.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isEventPaused, featuredEvents.length]);

  const currentEvent = featuredEvents[activeEventIndex] || featuredEvents[0];

  const roleForAudience =
    audience === "attendee" ? "user" : "organizer";
  const destinationFor = (userRole: string | undefined) => {
    if (isRegister && audience === "vendor") return "/vendor-dashboard";
    if (userRole === "admin") return "/admin";
    if (userRole === "organizer") return "/admin";
    if (userRole === "user") return "/dashboard";
    return returnTo || "/dashboard";
  };

  /** Clear a field's error as soon as the person edits it. */
  const clearFieldError = (field: FieldName) =>
    setFieldErrors((prev) =>
      prev[field] ? { ...prev, [field]: undefined } : prev,
    );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    // Check the form here first. The browser's type="email" hint does not
    // block a submit, and a round trip to be told the email is malformed is a
    // slower way to learn the same thing.
    const problems: FieldErrors = {};
    if (isRegister) {
      if (cleanUsername.length < 3) {
        problems.username = "Pick a username with at least 3 characters.";
      }
      if (!isValidEmail(cleanEmail)) problems.email = EMAIL_HINT;
      if (password.length < 8) {
        problems.password = "Use at least 8 characters.";
      }
      if (password !== confirmPassword) {
        problems.confirmPassword = "These two passwords do not match.";
      }
      if (!agreedToTerms) {
        problems.terms = "Tick the box to agree to the terms and privacy policy.";
      }
    } else {
      if (!cleanUsername) problems.username = "Enter the username you signed up with.";
      if (!password) problems.password = "Enter your password.";
    }

    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      toast({
        variant: "destructive",
        title: isRegister ? "Almost there" : "We need both fields",
        description: Object.values(problems)[0],
      });
      return;
    }

    setSubmitting(true);
    try {
      const user = isRegister
        ? await register({
            username: cleanUsername,
            email: cleanEmail,
            password,
            displayName: fullName.trim() || undefined,
            phone: phone.trim() || undefined,
            role: roleForAudience,
            acceptedTerms: true,
            audience: audience,
            ...(referralCode ? { referredBy: referralCode } : {}),
          })
        : await login({ username: cleanUsername, password });
      toast({
        title: isRegister ? activeAudience.success : "Welcome back.",
        description: isRegister ? undefined : "Good to have you.",
      });
      const dest = isRegister
        ? destinationFor((user as any)?.role)
        : returnTo || destinationFor((user as any)?.role);
      setLocation(dest);
    } catch (err) {
      toast({
        variant: "destructive",
        title: isRegister ? "We could not create that account" : "That did not work",
        description: errorMessage(err, "Give it another shot in a moment."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      // Google OAuth flow: redirect to backend OAuth endpoint
      window.location.href = `${BASE_URL}/api/auth/google`;
    } catch {
      setIsGoogleLoading(false);
      toast({
        variant: "destructive",
        title: "Google sign-in unavailable",
        description:
          "Google OAuth is not configured yet. Use email sign-in instead.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left — the brand panel. Sticky: it stays put while the form scrolls. */}
      <aside className="relative hidden lg:flex lg:sticky lg:top-0 lg:h-screen flex-col justify-between w-[44%] max-w-xl border-r border-hairline bg-surface p-12 overflow-hidden">
        {/* Ambient life: breathing warm glows + floating golden embers */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-32 -left-24 w-[480px] h-[480px] rounded-full animate-hero-glow"
            style={{
              background:
                "radial-gradient(circle, rgba(227,178,60,0.13) 0%, transparent 70%)",
              animationDuration: "12s",
            }}
          />
          <div
            className="absolute -bottom-40 -right-28 w-[500px] h-[500px] rounded-full animate-hero-glow"
            style={{
              background:
                "radial-gradient(circle, rgba(227,178,60,0.08) 0%, transparent 70%)",
              animationDuration: "16s",
              animationDelay: "-6s",
            }}
          />
          {PANEL_EMBERS.map((e, i) => (
            <span
              key={i}
              className="absolute rounded-full animate-ember"
              style={
                {
                  left: e.left,
                  bottom: e.bottom,
                  width: e.size,
                  height: e.size,
                  background: "#E3B23C",
                  boxShadow: "0 0 6px 1px rgba(227,178,60,0.55)",
                  animationDelay: e.delay,
                  animationDuration: e.duration,
                  "--ember-drift": e.drift,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer group w-fit">
              <img
                src={logoImg}
                alt="Black Heritage Events"
                className="h-10 w-10 object-contain"
              />
              <div className="leading-none">
                <p className="font-display text-lg font-bold text-ink group-hover:text-gold transition-colors">
                  Black Heritage
                </p>
                <p className="eyebrow mt-1">Events &amp; Entertainment</p>
              </div>
            </div>
          </Link>

          <div className="my-auto py-4">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
              </span>
              <p className="eyebrow text-gold font-bold">
                {isRegister ? "Join Black Heritage" : "Welcome Back"}
              </p>
            </div>
            <h2 className="font-display text-3xl xl:text-4xl font-bold text-ink leading-[1.15] tracking-tight">
              Where Nigeria comes out to{" "}
              <span className="italic text-gold">play</span>
            </h2>
            <div className="mt-3.5 h-0.5 w-12 bg-gold" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-ink leading-relaxed max-w-sm">
              One home for the shows worth showing up for, and the DJs,
              caterers, and creatives who make them unforgettable.
            </p>

            {/* Living Marquee: Real auto-advancing Lagos event showcase */}
            {featuredEvents.length > 0 && currentEvent && (
              <div
                className="my-5"
                onMouseEnter={() => setIsEventPaused(true)}
                onMouseLeave={() => setIsEventPaused(false)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-gold">
                    Trending On Sale
                  </span>
                  {featuredEvents.length > 1 && (
                    <div className="flex items-center gap-1.5" role="tablist" aria-label="Featured events">
                      {featuredEvents.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveEventIndex(idx)}
                          aria-label={`Show event ${idx + 1}`}
                          className={cn(
                            "h-1 rounded-full transition-all duration-300 cursor-pointer",
                            idx === activeEventIndex
                              ? "w-4 bg-gold"
                              : "w-1.5 bg-white/20 hover:bg-white/40"
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <Link href={"/events/" + currentEvent.id}>
                  <div className="group relative rounded-md border border-hairline bg-surface-2/85 hover:border-gold/40 transition-all duration-300 cursor-pointer overflow-hidden p-3 flex items-center gap-3.5 backdrop-blur-sm">
                    <div className="relative w-14 h-14 rounded overflow-hidden bg-surface border border-hairline shrink-0">
                      {currentEvent.imageUrl ? (
                        <img
                          src={currentEvent.imageUrl}
                          alt={currentEvent.title}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Ticket className="w-6 h-6 text-gold/60" />
                        </div>
                      )}
                      <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-background/90 rounded text-[8px] font-bold text-gold tracking-wider border border-hairline">
                        LIVE
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-gold flex items-center gap-1 truncate">
                        <CalendarDays className="w-3 h-3 shrink-0" />
                        <span>{format(new Date(currentEvent.date), "EEE d MMM")}</span>
                        {currentEvent.location && (
                          <>
                            <span className="text-muted-ink/40">·</span>
                            <span className="text-muted-ink truncate">
                              {currentEvent.location.split(",")[0]}
                            </span>
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 font-display text-sm font-semibold text-ink truncate group-hover:text-gold transition-colors">
                        {currentEvent.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink">
                          {currentEvent.price === 0
                            ? "Free Entry"
                            : `From ₦${(currentEvent.price / 100).toLocaleString()}`}
                        </span>
                        <span className="text-[10px] text-muted-ink border border-hairline px-1.5 py-0.2 rounded">
                          Instant Ticket
                        </span>
                      </div>
                    </div>

                    <ArrowUpRight
                      className="w-4 h-4 text-muted-ink shrink-0 group-hover:text-gold group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              </div>
            )}

            {/* Clean three-point value assurances */}
            <div className="space-y-2.5 max-w-sm">
              {[
                {
                  title: isRegister ? "Curated Shows" : "Guaranteed Entry",
                  desc: "Verified tickets with instant QR entry on your phone.",
                },
                {
                  title: "Direct Access",
                  desc: "Connect directly with top DJs, performers, and caterers.",
                },
                {
                  title: "Standing Profiles",
                  desc: "A portfolio for organizers and vendors to find real work.",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-2.5">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold shrink-0"
                    aria-hidden="true"
                  />
                  <div className="text-xs leading-relaxed">
                    <span className="text-ink font-medium">{item.title}</span>
                    <span className="text-muted-ink">: {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-5 border-t border-hairline">
            <div className="flex items-center justify-between text-xs text-muted-ink mb-2">
              <span className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-ink font-medium">
                  <span className="font-display font-bold text-gold tabular-nums">
                    {events?.length ?? 0}
                  </span>{" "}
                  shows on sale right now
                </span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-ink/70">
                Nigeria
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-ink">
              <span className="flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
                Instant e-tickets
              </span>
              <span className="flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
                Vendor directory
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Right — the form. Scrolls independently of the fixed brand panel. */}
      <main className="flex-1 flex flex-col items-center px-4 sm:px-8 py-10 overflow-y-auto lg:h-screen">
        {/* Compact brand lockup for mobile */}
        <Link href="/" className="lg:hidden mb-8">
          <div className="flex flex-col items-center cursor-pointer group">
            <img
              src={logoImg}
              alt="Black Heritage Events"
              className="h-14 w-14 object-contain mb-3"
            />
            <h1 className="text-2xl font-display font-bold text-ink group-hover:text-gold transition-colors">
              Black Heritage
            </h1>
            <p className="eyebrow mt-1">Events &amp; Entertainment</p>
          </div>
        </Link>

        <motion.div
          className="w-full max-w-md py-4 sm:py-8"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Segmented mode control with a spring slide */}
          <div
            className="grid grid-cols-2 gap-1 p-1 bg-surface-2 border border-hairline rounded-full mb-8"
            role="tablist"
            aria-label="Sign in or create an account"
          >
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={
                  "relative h-10 rounded-full text-sm font-medium transition-colors duration-200 " +
                  (mode === m ? "text-primary-foreground" : "text-muted-ink hover:text-ink")
                }
              >
                {mode === m && (
                  <motion.span
                    layoutId="auth-mode-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-primary"
                  />
                )}
                <span className="relative z-10">
                  {m === "login" ? "Sign in" : "Create account"}
                </span>
              </button>
            ))}
          </div>

          <h2 className="font-display text-3xl font-bold text-ink tracking-tight">
            {isRegister ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-2 text-muted-ink">
            {isRegister
              ? "It takes a minute. Pick how you're joining."
              : "Sign in with the username and password you chose. Your tickets and dashboard are where you left them."}
          </p>

          {/* Google sign-in button */}
          <div className="mt-6">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="press w-full h-12 flex items-center justify-center gap-3 bg-surface-2 border border-hairline rounded-full text-ink font-medium hover:bg-surface hover:border-white/30 transition-colors disabled:opacity-50"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {isGoogleLoading ? "Redirecting…" : "Continue with Google"}
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-hairline" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-ink">
                or continue with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div
                className="space-y-2"
                role="radiogroup"
                aria-label="How are you joining?"
              >
                <Label>How are you joining?</Label>
                {AUDIENCES.map((a) => {
                  const Icon = a.icon;
                  const selected = audience === a.key;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setAudience(a.key)}
                      className={
                        "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors " +
                        (selected
                          ? "border-gold bg-surface"
                          : "border-hairline bg-surface-2/50 hover:border-white/30")
                      }
                    >
                      <Icon
                        className={
                          "w-5 h-5 shrink-0 " +
                          (selected ? "text-gold" : "text-muted-ink")
                        }
                        aria-hidden="true"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-ink">
                          {a.label}
                        </span>
                        <span className="block text-xs text-muted-ink mt-0.5 leading-snug">
                          {a.benefit}
                        </span>
                      </span>
                      {selected && (
                        <Check
                          className="w-4 h-4 text-gold shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">
                {isRegister
                  ? audience === "organizer"
                    ? "Username (your handle)"
                    : audience === "vendor"
                      ? "Username (your handle)"
                      : "Username"
                  : "Username"}
              </Label>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={!!fieldErrors.username}
                className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearFieldError("username");
                }}
                required
              />
              <FieldError message={fieldErrors.username} />
            </div>

            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  {audience === "organizer"
                    ? "Your name (or the brand you run events as)"
                    : audience === "vendor"
                      ? "Your name or business name"
                      : "Full name"}
                </Label>
                <Input
                  id="fullName"
                  autoComplete="name"
                  placeholder={
                    audience === "organizer"
                      ? "e.g. Tunde Live Concepts"
                      : audience === "vendor"
                        ? "e.g. DJ Zoro Naija"
                        : "e.g. Ada Obi"
                  }
                  className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            {isRegister && (audience === "organizer" || audience === "vendor") && (
              <div className="space-y-2">
                <Label htmlFor="signup-phone">Phone / WhatsApp (optional)</Label>
                <Input
                  id="signup-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. 0812 345 6789"
                  className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-[11px] text-muted-ink">
                  For support on gate day. Never shown publicly.
                </p>
              </div>
            )}

            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={!!fieldErrors.email}
                  className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError("email");
                  }}
                  required
                />
                <FieldError message={fieldErrors.email} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  className="h-12 bg-surface-2 border-hairline text-ink pr-12 rounded-md focus-visible:border-gold focus-visible:ring-0"
                  aria-invalid={!!fieldErrors.password}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError("password");
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-ink hover:text-ink"
                >
                  {showPassword ? (
                    <EyeOff size={20} aria-hidden="true" />
                  ) : (
                    <Eye size={20} aria-hidden="true" />
                  )}
                </button>
              </div>
              <FieldError message={fieldErrors.password} />
              {isRegister && !fieldErrors.password && (
                <p className="text-[11px] text-muted-ink">At least 8 characters.</p>
              )}
            </div>

            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                  aria-invalid={!!fieldErrors.confirmPassword}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearFieldError("confirmPassword");
                  }}
                  required
                />
                <FieldError message={fieldErrors.confirmPassword} />
              </div>
            )}

            {isRegister && referralCode && (
              <div className="flex items-center gap-2 rounded-md border border-gold/30 bg-gold/10 px-3.5 py-2.5 text-xs text-ink">
                <Gift className="w-3.5 h-3.5 text-gold shrink-0" aria-hidden="true" />
                <span>
                  Invited with code <span className="font-semibold text-gold">{referralCode}</span>. Your friend gets credit when you finish signing up.
                </span>
              </div>
            )}

            {isRegister && (
              <label className="flex items-start gap-2.5 cursor-pointer select-none">                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => {
                      setAgreedToTerms(e.target.checked);
                      clearFieldError("terms");
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#E3B23C]"
                    required
                  />
                <span className="text-xs leading-relaxed text-muted-ink">
                  I agree to the{" "}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold underline underline-offset-2"
                  >
                    terms of service
                  </a>{" "}
                  and{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold underline underline-offset-2"
                  >
                    privacy policy
                  </a>
                  , including the ticket, refund, and commission terms.
                </span>
              </label>
            )}

            {isRegister && <FieldError message={fieldErrors.terms} />}

            <Button
              type="submit"
              disabled={submitting}
              className="press w-full h-14 bg-primary text-primary-foreground hover:bg-gold-soft font-medium text-base rounded-full"
            >
              {submitting
                ? isRegister
                  ? "Creating your account…"
                  : "Signing you in…"
                : isRegister
                  ? agreedToTerms
                    ? activeAudience.cta
                    : "Agree & create account"
                  : "Sign in"}
            </Button>

            {isRegister && (
              <p className="text-xs text-center text-muted-ink leading-relaxed">
                Free to join. Organizers and vendors get a dashboard;
                attendees just get first dibs on tickets.
              </p>
            )}
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() =>
                setMode(isRegister ? "login" : "register")
              }
              className="text-sm font-medium text-gold hover:text-gold-soft transition-colors"
            >
              {isRegister
                ? "Already have an account? Sign in"
                : "New to Black Heritage? Create an account"}
            </button>
          </div>

          <p className="mt-10 lg:hidden flex items-center justify-center gap-1.5 text-xs text-muted-ink">
            <ShieldCheck
              className="w-3.5 h-3.5 text-gold"
              aria-hidden="true"
            />
            Verified secure checkout on every ticket
          </p>
        </motion.div>
      </main>
    </div>
  );
}
