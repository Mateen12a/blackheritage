import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import logoImg from "../assets/logo.png";

export interface EventBrand {
  displayName?: string;
  logoUrl?: string;
}

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/talent", label: "Talent" },
  { href: "/calendar", label: "Calendar" },
  { href: "/organizers", label: "For Organizers" },
];

function isActive(href: string, location: string) {
  if (href === "/") return location === "/";
  return location === href || location.startsWith(href + "/");
}

/**
 * The brand slot shared by the platform mark and custom event brands:
 * logo mark, display name, and a micro credit line. Identical metrics in
 * both modes is what makes a custom event header look native, not bolted on.
 */
function BrandLockup({ logo, title, tag }: { logo: React.ReactNode; title: string; tag: string }) {
  return (
    <>
      <span className="shrink-0 flex items-center">{logo}</span>
      <span className="flex min-w-0 flex-col items-start gap-[2px] sm:gap-[3px]">
        {/* Responsive caps for small viewports so title and tag stay legible without colliding with action pills */}
        <span className="font-display text-xs min-[360px]:text-sm md:text-[15px] font-bold leading-none tracking-wide text-ink truncate max-w-[105px] min-[360px]:max-w-[130px] sm:max-w-[180px] md:max-w-[230px]">
          {title}
        </span>
        <span className="hidden min-[340px]:block text-[6px] min-[360px]:text-[6.5px] md:text-[7px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] leading-none text-muted-ink">
          {tag}
        </span>
      </span>
    </>
  );
}

/**
 * Segmented capsule header, modeled on the Partyverse reference: three
 * segments sit close together, and the corners that face each other are
 * barely rounded while the outer corners are fully round, so the three
 * pieces read as one connected capsule. Brand left, links center, actions
 * right. Below lg the links collapse into a Menu pill (like the reference's
 * mobile header) and Sign In sits beside it.
 */
export function Navbar({ eventBrand, overMedia }: { eventBrand?: EventBrand | null; overMedia?: boolean } = {}) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Mobile bar picks up a solid blurred background once the page scrolls,
  // so content never slides behind the brand. Transparent at the top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isOrg = user && (user.role === "organizer" || user.role === "admin" || user.isAdmin);
  const links = [
    { href: "/", label: "Home" },
    { href: "/events", label: "Events" },
    { href: "/talent", label: "Talent" },
    { href: "/challenges", label: "Challenges" },
  ];

  if (!user) {
    links.push({ href: "/organizers", label: "For Organizers" });
  } else {
    links.push({
      href: isOrg ? "/admin" : user.role === "vendor" ? "/vendor-dashboard" : "/dashboard",
      label: isOrg ? "Dashboard" : user.role === "vendor" ? "Talent Studio" : "My Dashboard",
    });
  }

  const surface =
    "border border-hairline bg-surface/90 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)]";
  const mobilePill =
    "border border-hairline bg-surface/90 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.4)]";

  // One lockup for both modes so a custom brand sits in the exact slot and
  // scale the platform brand uses: mark left, name, platform credit below.
  const brand = eventBrand?.displayName || eventBrand?.logoUrl ? (
    <BrandLockup
      title={eventBrand?.displayName || "Event"}
      tag="on BlackHeritage"
      logo={
        eventBrand?.logoUrl ? (
          <img
            src={eventBrand.logoUrl}
            alt=""
            className="h-7 w-7 min-[380px]:h-8 min-[380px]:w-8 rounded-lg object-cover ring-1 ring-hairline bg-surface-2"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-7 w-7 min-[380px]:h-8 min-[380px]:w-8 items-center justify-center rounded-lg bg-primary font-display text-xs sm:text-sm font-bold text-primary-foreground"
          >
            {(eventBrand?.displayName || "E").slice(0, 1).toUpperCase()}
          </span>
        )
      }
    />
  ) : (
    <BrandLockup
      title="Black Heritage"
      tag="Entertainment & Events"
      logo={<img src={logoImg} alt="" className="h-7 w-7 min-[380px]:h-8 min-[380px]:w-8 object-contain" />}
    />
  );

  return (
    <nav
      className={cn(
        "fixed z-40 left-2.5 right-2.5 min-[380px]:left-3 min-[380px]:right-3 top-[calc(env(safe-area-inset-top)+0.4rem)] lg:left-0 lg:right-0 lg:top-4 lg:px-5 transition-colors duration-300",
        "max-lg:rounded-2xl max-lg:border max-lg:border-hairline max-lg:backdrop-blur-xl max-lg:shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
        isMobileMenuOpen
          ? "max-lg:bg-surface/98 max-lg:border-hairline/80 max-lg:shadow-[0_16px_50px_rgba(0,0,0,0.6)]"
          : scrolled
          ? "max-lg:bg-surface/90"
          : "max-lg:bg-surface/60"
      )}
    >
      {/* Mobile: brand pinned left, actions pinned right. Desktop: capsule centered. */}
      <div className="flex items-center justify-between lg:justify-center gap-1.5 px-2.5 min-[380px]:px-3 lg:px-0 py-1.5 min-[380px]:py-2 lg:py-0">
        {/* Brand segment (desktop): full-round left corners, tight right corners */}
        <Link
          href="/"
          aria-label={eventBrand?.displayName ? `${eventBrand.displayName} on BlackHeritage` : "Black Heritage Entertainment & Events home"}
          className={cn(
            "press shrink-0 h-[52px] pl-3.5 pr-5 rounded-l-full rounded-r-lg hidden lg:flex items-center gap-2.5",
            surface
          )}
        >
          {brand}
        </Link>

        {/* Links segment (desktop): tight corners both sides */}
        <div className={cn("hidden lg:flex h-[52px] px-2 rounded-lg items-center gap-1", surface)}>
          {links.map((link) => {
            const active = isActive(link.href, location);
            return (
              <Link key={link.href} href={link.href}>
                <span
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center h-9 px-4 rounded-full text-[13px] font-medium tracking-wide transition-colors duration-200 cursor-pointer",
                    active
                      ? "bg-surface-2 text-gold"
                      : "text-muted-ink hover:text-ink hover:bg-surface-2/60"
                  )}
                >
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Actions segment (desktop): tight left corners, full-round right */}
        <div
          className={cn(
            "hidden lg:flex h-[52px] pl-2 pr-2.5 rounded-l-lg rounded-r-full items-center gap-1.5 shrink-0",
            surface
          )}
        >
          {user ? (
            <>
              <Link href={links[links.length - 1].href}>
                <span className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-surface-2/60 transition-colors cursor-pointer">
                  <span className="w-7 h-7 rounded-full bg-surface-2 border border-hairline flex items-center justify-center text-xs font-bold text-gold uppercase">
                    {(user.username || "U").charAt(0)}
                  </span>
                  <span className="text-[13px] text-muted-ink max-w-[90px] truncate">
                    {user.username}
                  </span>
                </span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Sign out"
                className="h-8 w-8 p-0 text-muted-ink hover:text-ink hover:bg-surface-2 rounded-full"
                onClick={() => logout()}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Link href="/auth">
                <span className="text-[13px] font-medium text-muted-ink hover:text-ink transition-colors cursor-pointer px-3 py-2">
                  Sign In
                </span>
              </Link>
              <Link href="/auth?tab=register">
                <span className="press inline-flex items-center h-9 px-5 rounded-full bg-primary text-primary-foreground text-[13px] font-medium hover:bg-gold-soft transition-colors cursor-pointer">
                  Get Started
                </span>
              </Link>
            </>
          )}
        </div>

        {/* Mobile: bare brand left, Sign In + Menu pills right. min-w-0 lets
            the lockup shrink on narrow screens so a long event title
            truncates rather than overlapping the action pills. */}
        <Link
          href="/"
          aria-label={eventBrand?.displayName ? `${eventBrand.displayName} on BlackHeritage` : "Black Heritage Entertainment & Events home"}
          className={cn(
            "lg:hidden flex items-center gap-2.5 min-w-0 pl-1"
          )}
        >
          {brand}
        </Link>
        <div className="lg:hidden flex items-center gap-1.5 min-[360px]:gap-2 shrink-0">
          {!user && (
            <Link href="/auth">
              <span className="press inline-flex items-center h-8 sm:h-9 px-3 min-[380px]:px-3.5 rounded-full text-xs font-semibold text-ink/90 bg-surface-2/90 border border-hairline hover:border-gold/40 hover:text-gold transition-colors cursor-pointer">
                Sign In
              </span>
            </Link>
          )}
          <button
            className={cn(
              "press flex items-center gap-1.5 h-8 sm:h-9 px-2.5 min-[380px]:px-3 rounded-full text-xs font-semibold transition-colors duration-200 border",
              isMobileMenuOpen
                ? "bg-gold/15 text-gold border-gold/40 shadow-sm"
                : "border-hairline/70 bg-surface-2/70 text-ink/90 hover:text-ink hover:border-hairline"
            )}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X size={15} strokeWidth={2.5} />
            ) : (
              <Menu size={15} strokeWidth={2.5} />
            )}
            <span className="hidden min-[380px]:inline">Menu</span>
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-hairline/60 pt-3 pb-3 px-1 mt-1">
          <div className="flex flex-col gap-1">
            {links.map((link) => {
              const active = isActive(link.href, location);
              return (
                <Link key={link.href} href={link.href}>
                  <span
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center justify-between px-3.5 py-3 rounded-xl text-[15px] font-medium transition-all duration-150 cursor-pointer group",
                      active
                        ? "bg-gold/10 text-gold font-semibold border border-gold/25"
                        : "text-ink/85 hover:text-ink hover:bg-surface-2/60 border border-transparent"
                    )}
                  >
                    <span>{link.label}</span>
                    {active ? (
                      <span className="w-2 h-2 rounded-full bg-gold shadow-[0_0_10px_#E3B23C]" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-muted-ink/35 group-hover:text-gold group-hover:translate-x-0.5 transition-all" />
                    )}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-hairline/60 flex flex-col gap-2">
            {user ? (
              <>
                <div className="flex items-center gap-3 px-3 py-2 bg-surface-2/40 rounded-xl border border-hairline/50">
                  <div className="w-9 h-9 rounded-full bg-surface-2 border border-hairline flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-gold uppercase">
                      {(user.username || "U").charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{user.username}</p>
                    <p className="text-xs text-muted-ink capitalize">{user.role}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-ink hover:text-ink hover:bg-surface-2 justify-start h-10 rounded-xl"
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-2 px-1">
                <Link href="/auth?tab=register">
                  <Button
                    size="sm"
                    className="w-full bg-gold text-[#0F0F14] hover:bg-gold-soft font-bold text-sm h-11 rounded-xl shadow-[0_4px_20px_rgba(227,178,60,0.25)] flex items-center justify-center gap-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Get Started
                  </Button>
                </Link>
                <Link href="/auth">
                  <button
                    className="w-full py-2 text-center text-xs font-medium text-muted-ink hover:text-ink transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Already have an account? <span className="text-gold font-semibold underline underline-offset-2">Sign in</span>
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
