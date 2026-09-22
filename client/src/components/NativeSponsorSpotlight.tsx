import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BadgeCheck } from "lucide-react";
import { FadeImg, Reveal } from "@/components/motion";

export interface NativeSponsor {
  id: string;
  title: string;
  sponsorName: string;
  tagline: string;
  badgeText: string;
  imageUrl: string;
  targetUrl: string;
  placement: "home_spotlight" | "explore_feed" | "events_sidebar";
  clicks: number;
  impressions: number;
}

interface NativeSponsorSpotlightProps {
  placement?: "home_spotlight" | "explore_feed" | "events_sidebar";
  className?: string;
}

export function NativeSponsorSpotlight({
  placement = "home_spotlight",
  className = "",
}: NativeSponsorSpotlightProps) {
  const { data: sponsors } = useQuery<NativeSponsor[]>({
    queryKey: ["/api/sponsors/active", placement],
    queryFn: async () => {
      const res = await fetch(`/api/sponsors/active?placement=${placement}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const sponsor = sponsors && sponsors.length > 0 ? sponsors[0] : null;

  if (!sponsor) return null;

  const handleClick = () => {
    fetch(`/api/sponsors/${sponsor.id}/click`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  };

  const isExternal = sponsor.targetUrl.startsWith("http");

  return (
    <Reveal className={className}>
      <aside
        aria-label="Featured partner spotlight"
        className="group relative overflow-hidden rounded-xl p-[1px] bg-gradient-to-b from-[#31313A] to-[#19191F]/30"
      >
        <div className="relative rounded-[11px] bg-[#121217] border border-hairline overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
            {/* Visual art banner */}
            <div className="lg:col-span-5 relative aspect-[16/9] lg:aspect-auto lg:h-full min-h-[220px] overflow-hidden bg-surface-2">
              <FadeImg
                src={sponsor.imageUrl}
                alt={sponsor.title}
                data-motion="scale-on-hover"
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-[#121217] via-[#121217]/20 to-transparent"
              />
            </div>

            {/* Editorial copy and action */}
            <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase bg-gold/10 text-gold border border-gold/30">
                  <BadgeCheck className="w-3.5 h-3.5 text-gold shrink-0" aria-hidden="true" />
                  {sponsor.badgeText || "Official Partner"}
                </span>
                <span className="text-xs text-muted-ink font-medium">
                  {sponsor.sponsorName}
                </span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight leading-snug">
                {sponsor.title}
              </h3>

              <p className="mt-2.5 text-sm sm:text-base text-muted-ink leading-relaxed max-w-xl">
                {sponsor.tagline}
              </p>

              <div className="mt-6 flex items-center gap-4">
                <a
                  href={sponsor.targetUrl}
                  onClick={handleClick}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className="press inline-flex items-center justify-center gap-2 h-11 px-6 rounded-md bg-gold text-[#0F0F14] font-medium text-sm hover:bg-gold-soft transition-colors cursor-pointer shadow-sm"
                >
                  <span>Experience Now</span>
                  <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                </a>
                <span className="text-xs text-muted-ink">
                  Curated partner spotlight
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </Reveal>
  );
}
