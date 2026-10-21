import { FormEvent, useState } from "react";
import { Link, useSearch } from "wouter";
import { Eye, EyeOff, Loader2, MailCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoImg from "../assets/logo.png";

/**
 * /forgot-password asks for an email or username and sends a reset link.
 * /reset-password?token=… sets the new password. One page, two states, so the
 * look and the copy stay identical across the flow.
 */
export default function PasswordReset() {
  const search = new URLSearchParams(useSearch());
  const token = search.get("token") || "";
  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-12">
      <Link href="/" className="mb-10 flex items-center gap-3">
        <img src={logoImg} alt="Black Heritage" className="h-10 w-10 object-contain" />
        <span className="font-display text-lg font-bold text-ink">Black Heritage</span>
      </Link>
      <div className="w-full max-w-sm">{token ? <SetPassword token={token} /> : <RequestLink />}</div>
    </div>
  );
}

function RequestLink() {
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not send the link. Try again in a moment.");
      setSent(body.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <MailCheck className="w-10 h-10 text-gold mx-auto" aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Check your email</h1>
        <p className="mt-3 text-sm text-muted-ink leading-relaxed">{sent}</p>
        <p className="mt-2 text-xs text-muted-ink">The link expires in 1 hour.</p>
        <Link href="/auth" className="mt-8 inline-block text-sm text-gold hover:underline underline-offset-4">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Forgot your password?</h1>
        <p className="mt-2 text-sm text-muted-ink">Enter the email or username on your account. We will email you a link to set a new password.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="identifier">Email or username</Label>
        <Input
          id="identifier"
          autoFocus
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="h-12 bg-surface-2 border-hairline"
        />
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" disabled={busy || !identifier.trim()} className="press w-full h-12 bg-primary text-primary-foreground hover:bg-gold-soft">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send reset link"}
      </Button>
      <p className="text-center text-sm text-muted-ink">
        Remembered it? <Link href="/auth" className="text-gold hover:underline underline-offset-4">Sign in</Link>
      </p>
    </form>
  );
}

function SetPassword({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not update the password.");
      setDone(body.username || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done !== null) {
    return (
      <div className="text-center">
        <CheckCircle2 className="w-10 h-10 text-gold mx-auto" aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Password updated</h1>
        {done && <p className="mt-3 text-sm text-muted-ink">Sign in as <span className="text-ink font-medium">{done}</span> with your new password.</p>}
        <Link href="/auth">
          <Button className="press mt-8 w-full h-12 bg-primary text-primary-foreground hover:bg-gold-soft">Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-ink">At least 8 characters.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={show ? "text" : "password"}
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 bg-surface-2 border-hairline pr-11"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-ink hover:text-ink"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-12 bg-surface-2 border-hairline"
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}{" "}
          {/expired|incomplete|used/i.test(error) && (
            <Link href="/forgot-password" className="underline underline-offset-4">Request a new link</Link>
          )}
        </p>
      )}
      <Button type="submit" disabled={busy} className="press w-full h-12 bg-primary text-primary-foreground hover:bg-gold-soft">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
      </Button>
    </form>
  );
}
