import { useMemo } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ArrowUpRight, Instagram, MessageCircle, Megaphone, Trophy } from "lucide-react";
import { useEvents } from "@/hooks/use-events";
import { priceLabelFor } from "@/lib/event-price";
import { cleanVia, rememberVia } from "@/lib/via";
import { BLACK_HERITAGE_WHATSAPP_COMMUNITY_URL } from "@/lib/contact";
import { FadeImg } from "@/components/motion";
import { TALENT_HUNT, challengePhase } from "@shared/challenge";
import logo from "@/assets/logo.png";

/**
 * The link in our Instagram and TikTok bios. One screen: what's on sale, the
 * BH Challenge, and the two other doors (list an event, join the community).
 * /links/ig and /links/tiktok tag every ticket sale that starts here as
 * "bh-ig" / "bh-tiktok", so we can see which platform actually sells.
 */
export default function LinksPage({ src }: { src?: string }) {
  const via = `bh-${cleanVia(src) || "links"}`;
  const { data: events } = useEvents();
  const phase = challengePhase();

  const onSale = useMemo(() => {
    const now = Date.now();
    return ((events as any[]) || [])
      .filter((e) => {
        const t = e.date ? new Date(e.date).getTime() : 0;
        return t > now && (e.status ?? "published") === "published" && (e.visibility ?? "public") === "public" && !e.isDemo;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 4);
  }, [events]);

  const pool = `₦${(TALENT_HUNT.prizeNaira * 3).toLocaleString("en-NG")}`;
  const challengeLine =
    phase === "upcoming"
      ? "Entries open soon. Free to enter."
      : phase === "open"
        ? `Enter free before ${TALENT_HUNT.closesOn}`
        : phase === "judging"
          ? `Top 10 out ${TALENT_HUNT.shortlistOn}, winners ${TALENT_HUNT.winnersOn}`
          : "See the winners";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-md px-4 pb-16 pt-10">
        <header className="flex flex-col items-center text-center">
          <img src={logo} alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-full border border-hairline bg-surface object-contain p-2" />
          <h1 className="mt-4 font-display text-3xl font-bold text-ink">Black Heritage</h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-ink">
            Tickets, tables and talent. Rooted in Lagos, on stage across Nigeria.
          </p>
        </header>

        {onSale.length > 0 && (
          <section className="mt-8" aria-labelledby="on-sale">
            <h2 id="on-sale" className="eyebrow">
              On sale now
            </h2>
            <ul className="mt-3 space-y-2.5">
              {onSale.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/e/${e.slug || e.id}`}
                    onClick={() => rememberVia(via)}
                    className="group flex items-center gap-3 rounded-md border border-hairline bg-surface p-2.5 transition-colors hover:border-gold/50"
                  >
                    <div className="h-20 w-[60px] shrink-0 overflow-hidden rounded bg-surface-2">
                      {e.imageUrl && (
                        <FadeImg
                          src={e.imageUrl}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          data-motion="scale-on-hover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-base font-bold text-ink transition-colors group-hover:text-gold">{e.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-ink">
                        {format(new Date(e.date), "EEE d MMM")}
                        {e.location ? ` · ${String(e.location).split(",")[0]}` : ""}
                      </p>
                      <p className="mt-1 text-xs font-medium text-ink">{priceLabelFor(e)}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-ink group-hover:text-gold" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8 space-y-2.5" aria-label="More from Black Heritage">
          {phase !== "winners" && (
            <Link
              href="/challenges"
              className="press flex items-center gap-3 rounded-md bg-primary px-4 py-3.5 text-primary-foreground transition-colors hover:bg-gold-soft"
            >
              <Trophy className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{TALENT_HUNT.title}: {pool} in prizes up for grabs</span>
                <span className="block text-xs opacity-80">{challengeLine}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          )}

          <Link
            href="/organizers"
            className="flex items-center gap-3 rounded-md border border-hairline bg-surface px-4 py-3.5 transition-colors hover:border-gold/50"
          >
            <Megaphone className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">Hosting something? List it free</span>
              <span className="block text-xs text-muted-ink">Tickets, tables and payouts in one link</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-ink" aria-hidden="true" />
          </Link>

          <a
            href={BLACK_HERITAGE_WHATSAPP_COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md border border-hairline bg-surface px-4 py-3.5 transition-colors hover:border-gold/50"
          >
            <MessageCircle className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">Join the WhatsApp community</span>
              <span className="block text-xs text-muted-ink">Drops, early-bird prices and giveaways first</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-ink" aria-hidden="true" />
          </a>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-ink">
          <a href={TALENT_HUNT.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-ink">
            <Instagram className="h-3.5 w-3.5" aria-hidden="true" /> Instagram
          </a>
          <a href={TALENT_HUNT.tiktok} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
            TikTok
          </a>
          <Link href="/" className="hover:text-ink">
            blackhevents.com
          </Link>
        </footer>
      </main>
    </div>
  );
}
