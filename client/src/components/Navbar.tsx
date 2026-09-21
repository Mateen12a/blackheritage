import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import logoImg from "../assets/logo.png";

export interface EventBrand {
  displayName?: string;
  logoUrl?: string;
}

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/vendors", label: "Vendors" },
  { href: "/calendar", label: "Calendar" },
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
      <span className="flex min-w-0 flex-col items-start gap-[3px]">
        <span className="font-display text-sm md:text-[15px] font-bold leading-none tracking-wide text-ink truncate max-w-[140px] sm:max-w-[180px] md:max-w-[230px]">
          {title}
        </span>
        <span className="text-[6.5px] md:text-[7px] font-bold uppercase tracking-[0.2em] leading-none text-muted-ink">
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

  const links = [...publicLinks];
  if (user) {
    const isOrg = user.role === "organizer" || user.role === "admin" || user.isAdmin;
    links.push({
      href: isOrg ? "/admin" : user.role === "vendor" ? "/vendor-dashboard" : "/dashboard",
      label: isOrg ? "Dashboard" : user.role === "vendor" ? "My Profile" : "My Dashboard",
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
            className="h-8 w-8 rounded-lg object-cover ring-1 ring-hairline bg-surface-2"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground"
          >
            {(eventBrand?.displayName || "E").slice(0, 1).toUpperCase()}
          </span>
        )
      }
    />
  ) : (
    <BrandLockup
      title="Black Heritage"
      tag="Events & Entertainment"
      logo={<img src={logoImg} alt="" className="h-8 w-8 object-contain" />}
    />
  );

  return (
    <nav
      className={cn(
        "fixed inset-x-0 z-40 lg:top-4 lg:px-5 pt-[env(safe-area-inset-top)] lg:pt-0 transition-colors duration-300",
        scrolled
          ? "max-lg:bg-background/85 max-lg:backdrop-blur-xl max-lg:border-b max-lg:border-hairline"
          : "max-lg:bg-transparent max-lg:border-b max-lg:border-transparent"
      )}
    >
      {/* Mobile: brand pinned left, actions pinned right. Desktop: capsule centered. */}
      <div className="flex items-center justify-between lg:justify-center gap-1.5 px-3 lg:px-0 py-2 lg:py-0">
        {/* Brand segment (desktop): full-round left corners, tight right corners */}
        <Link
          href="/"
          aria-label={eventBrand?.displayName ? `${eventBrand.displayName} on BlackHeritage` : "Black Heritage Events home"}
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

        {/* Mobile: bare brand left, Sign In + Menu pills right, like the reference */}
        <Link
          href="/"
          aria-label={eventBrand?.displayName ? `${eventBrand.displayName} on BlackHeritage` : "Black Heritage Events home"}
          className={cn(
            "lg:hidden flex items-center gap-2.5",
            // On event pages the brand sits over arbitrary flyers: a soft
            // scrim keeps it legible on light or busy images, branded or not.
            overMedia && "rounded-xl bg-background/60 backdrop-blur-md px-2.5 py-1.5 -ml-1"
          )}
        >
          {brand}
        </Link>
        <div className="lg:hidden flex items-center gap-2 shrink-0">
          {!user && (
            <Link href="/auth">
              <span className="press inline-flex items-center h-11 px-5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground border border-gold-soft/30 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:bg-gold-soft transition-colors cursor-pointer">
                Sign In
              </span>
            </Link>
          )}
          <button
            className={cn(
              "press flex items-center gap-2 h-11 pl-3.5 pr-4 rounded-xl text-sm font-semibold transition-colors duration-200",
              mobilePill,
              isMobileMenuOpen ? "text-ink" : "text-muted-ink hover:text-ink"
            )}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X size={20} strokeWidth={2.5} />
            ) : (
              <Menu size={20} strokeWidth={2.5} />
            )}
            Menu
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {isMobileMenuOpen && (
        <div className="lg:hidden mt-2 bg-surface/95 backdrop-blur-xl border border-hairline rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <div className="px-4 py-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-between py-3.5 text-[15px] font-medium border-b border-hairline/40 last:border-0",
                    isActive(link.href, location) ? "text-gold" : "text-muted-ink"
                  )}
                >
                  {link.label}
                  {isActive(link.href, location) && (
                    <span aria-hidden="true" className="h-0.5 w-5 bg-gold rounded-full" />
                  )}
                </span>
              </Link>
            ))}

            <div className="pt-3 pb-2 flex flex-col gap-2">
              {user ? (
                <>
                  <div className="flex items-center gap-2.5 px-1 py-2">
                    <div className="w-8 h-8 rounded-full bg-surface-2 border border-hairline flex items-center justify-center">
                      <span className="text-xs font-bold text-gold uppercase">
                        {(user.username || "U").charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{user.username}</p>
                      <p className="text-[11px] text-muted-ink capitalize">{user.role}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-ink justify-start h-9"
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </Button>
                </>
              ) : (
                <Link href="/auth?tab=register">
                  <Button
                    size="sm"
                    className="w-full bg-primary text-primary-foreground h-11 rounded-full"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Get Started
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
