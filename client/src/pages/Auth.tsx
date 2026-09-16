import { useState, FormEvent } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Ticket,
  CalendarDays,
  Store,
  Check,
} from "lucide-react";
import logoImg from "../assets/logo.png";

type Mode = "login" | "register";
type Audience = "attendee" | "organizer" | "vendor";

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
    success: "You're in. See what Lagos is up to this weekend.",
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
  const [audience, setAudience] = useState<Audience>("attendee");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();

  const isRegister = mode === "register";
  const activeAudience = AUDIENCES.find((a) => a.key === audience)!;

  const roleForAudience =
    audience === "attendee" ? "user" : "organizer";
  const destinationFor = (userRole: string | undefined) => {
    if (isRegister && audience === "vendor") return "/vendor-dashboard";
    if (userRole === "admin") return "/admin";
    if (userRole === "organizer") return "/admin";
    if (userRole === "user") return "/dashboard";
    return returnTo || "/dashboard";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isRegister && password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Check both password fields and try again.",
      });
      return;
    }
    try {
      const user = isRegister
        ? await register({
            username,
            email,
            password,
            role: roleForAudience,
          })
        : await login({ username, password });
      toast({
        title: isRegister ? activeAudience.success : "Welcome back.",
        description: isRegister ? undefined : "Good to have you.",
      });
      const dest = isRegister
        ? destinationFor((user as any)?.role)
        : returnTo || destinationFor((user as any)?.role);
      setLocation(dest);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "That didn't go through",
        description: err.message || "Give it another shot in a moment.",
      });
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
      {/* Left — the brand panel (desktop only) */}
      <aside className="hidden lg:flex flex-col justify-between w-[44%] max-w-xl border-r border-hairline bg-surface p-12">
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

        <div>
          <p className="eyebrow">Lagos events &amp; entertainment</p>
          <h2 className="mt-4 font-display text-4xl xl:text-5xl font-bold text-ink leading-[1.1] tracking-tight">
            Where Lagos comes out to{" "}
            <span className="italic text-gold">play</span>
          </h2>
          <p className="mt-4 text-muted-ink leading-relaxed max-w-md">
            One place for the events worth showing up for, and the people who
            make them happen. No forwarded flyers, no guessing off a random
            Instagram page.
          </p>

          <div className="mt-10 space-y-6 max-w-md">
            {[
              {
                title: "Stop guessing",
                body: "Know which event is actually worth your night before you pay for it.",
              },
              {
                title: "Sell out like a pro",
                body: "Ticketing, Paystack checkout, and a dashboard that tracks every sale.",
              },
              {
                title: "Get booked on your work",
                body: "A standing profile with your portfolio, so strangers with budgets can find you.",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <span
                  className="mt-2 h-1.5 w-1.5 rounded-full bg-gold shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-ink font-medium">{item.title}</p>
                  <p className="text-sm text-muted-ink leading-relaxed">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-ink">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
            Paystack-secured checkout
          </span>
          <span className="flex items-center gap-1.5">
            <Ticket className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
            Instant verified e-tickets
          </span>
          <span className="flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
            Free vendor profiles
          </span>
        </div>
      </aside>

      {/* Right — the form */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
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

        <div className="w-full max-w-md">
          {/* Segmented mode control */}
          <div
            className="grid grid-cols-2 gap-1 p-1 bg-surface-2 border border-hairline rounded-md mb-8"
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
                  "h-10 rounded-[4px] text-sm font-medium transition-colors " +
                  (mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-ink hover:text-ink")
                }
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <h2 className="font-display text-3xl font-bold text-ink tracking-tight">
            {isRegister ? "Join Lagos" : "Welcome back"}
          </h2>
          <p className="mt-2 text-muted-ink">
            {isRegister
              ? "It takes a minute. Pick how you're joining."
              : "Your tickets, dashboard, and vendor profile are where you left them."}
          </p>

          {/* Google sign-in button */}
          <div className="mt-6">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="press w-full h-12 flex items-center justify-center gap-3 bg-surface-2 border border-hairline rounded-md text-ink font-medium hover:bg-surface hover:border-white/30 transition-colors disabled:opacity-50"
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
                        "w-full flex items-center gap-3 p-3.5 rounded-md border text-left transition-colors " +
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
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            </div>

            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="h-12 bg-surface-2 border-hairline text-ink rounded-md focus-visible:border-gold focus-visible:ring-0"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}

            <Button
              type="submit"
              className="press w-full h-14 bg-primary text-primary-foreground hover:bg-gold-soft font-medium text-base rounded-md"
            >
              {isRegister ? activeAudience.cta : "Sign In"}
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
            Paystack-secured checkout on every ticket
          </p>
        </div>
      </main>
    </div>
  );
}
