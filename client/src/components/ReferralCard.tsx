import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Gift, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ReferralInfo {
  code: string;
  link: string;
  invites: number;
  referredBy: string | null;
}

/**
 * The user's own referral code: one card, one job. Copy the link, see how
 * many people have come in through it. Every account has a code; nothing to
 * opt into, nothing to configure.
 */
export function ReferralCard() {
  const { data, isLoading } = useQuery<ReferralInfo>({
    queryKey: ["/api/referrals/me"],
    queryFn: async () => {
      const res = await fetch("/api/referrals/me", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load your referral code");
      return res.json();
    },
    staleTime: 60_000,
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    if (!data?.link) return;
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the link stays visible as fallback.
    }
  };

  return (
    <Card className="border-hairline bg-surface">
      <CardHeader>
        <CardTitle className="text-ink flex items-center gap-2">
          <Gift className="w-4 h-4 text-gold" aria-hidden="true" />
          Invite friends
        </CardTitle>
        <CardDescription>
          Share your link. When someone signs up through it, the invite is counted to your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-ink">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your code...
          </div>
        ) : data ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 min-w-0 flex items-center gap-3 rounded-md border border-hairline bg-surface-2 px-3.5 h-11">
                <span className="font-mono text-sm text-gold tracking-wider">
                  {data.code}
                </span>
                <span className="text-muted-ink/60 text-xs truncate hidden sm:block">
                  {data.link}
                </span>
              </div>
              <button
                onClick={copy}
                className="press inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-gold-soft transition-colors cursor-pointer text-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" /> Copy link
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-muted-ink">
              {data.invites === 0
                ? "No invites yet. Your link works everywhere: WhatsApp status, Instagram bio, group chats."
                : `${data.invites} ${data.invites === 1 ? "person has" : "people have"} signed up with your link.`}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
