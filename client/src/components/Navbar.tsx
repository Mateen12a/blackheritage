import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut, Menu, X, ChevronRight } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import logoImg from "../assets/logo.png";

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

export function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  const links = [...publicLinks];
  if (user) {
    const isOrg = user.role === "organizer" || user.role === "admin" || user.isAdmin;
    links.push({
      href: isOrg ? "/admin" : user.role === "vendor" ? "/vendor-dashboard" : "/dashboard",
      label: isOrg ? "Dashboard" : user.role === "vendor" ? "My Profile" : "My Dashboard",
    });
  }

  const activeHref = links.find((l) => isActive(l.href, location))?.href;

  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = activeHref ? linkRefs.current[activeHref] : null;
    setUnderline(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
  }, [activeHref, location]);

  useEffect(() => {
    const reposition = () => {
      const el = activeHref ? linkRefs.current[activeHref] : null;
      if (el) setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
    };
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [activeHref]);

  const underlineStyle: CSSProperties = underline
    ? {
        opacity: 1,
        width: underline.width + "px",
        transform: "translateX(" + underline.left + "px)",
      }
    : { opacity: 0 };

  return (
    <nav className="fixed top-4 left-4 right-4 z-40 md:top-5 md:left-5 md:right-5 border border-hairline bg-background/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/20">
      <div className="container mx-auto px-4 md:px-5 h-14 md:h-[68px] flex items-center justify-between gap-2">
        {/* Brand */}
        <Link href="/" aria-label="Black Heritage Events home" className="shrink-0">
          <span className="flex items-center gap-2.5 cursor-pointer">
            <img src={logoImg} alt="" className="h-8 w-8 md:h-9 md:w-9 object-contain" />
            <span className="flex flex-col leading-none gap-0.5">
              <span className="font-display text-base md:text-lg font-bold tracking-wide text-ink">
                Black Heritage
              </span>
              <span className="text-[8px] md:text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
                Events &amp; Entertainment
              </span>
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="relative hidden md:block">
          <div className="flex items-center gap-7">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                ref={(el) => { linkRefs.current[link.href] = el; }}
                aria-current={isActive(link.href, location) ? "page" : undefined}
                className={cn(
                  "py-2 text-sm font-medium tracking-wide transition-colors duration-200 hover:text-gold focus-visible:text-gold",
                  isActive(link.href, location) ? "text-gold" : "text-muted-ink"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <span
            aria-hidden="true"
            style={underlineStyle}
            className="pointer-events-none absolute -bottom-px left-0 h-0.5 bg-gold transition-[transform,width,opacity] duration-300 ease-out"
          />
        </div>

        {/* Desktop auth cluster */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-surface-2 border border-hairline flex items-center justify-center">
                  <span className="text-xs font-bold text-gold uppercase">
                    {(user.username || "U").charAt(0)}
                  </span>
                </div>
                <span className="text-sm text-muted-ink max-w-[100px] truncate">
                  {user.username}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-ink hover:text-ink hover:bg-surface-2"
                onClick={() => logout()}
              >
                <LogOut className="w-4 h-4 mr-1.5" /> Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth">
                <span className="text-sm font-medium text-muted-ink hover:text-ink transition-colors cursor-pointer px-2 py-1">
                  Sign In
                </span>
              </Link>
              <Link href="/auth?tab=register">
                <Button className="h-9 px-5 bg-primary text-primary-foreground hover:bg-gold-soft font-medium rounded-md text-sm">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile: Get Started pill + hamburger */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          {!user && (
            <Link href="/auth?tab=register">
              <span className="inline-flex items-center h-8 px-3.5 rounded-full bg-primary text-primary-foreground text-xs font-medium cursor-pointer">
                Get Started
              </span>
            </Link>
          )}
          <button
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-200",
              isMobileMenuOpen
                ? "bg-surface border-hairline text-ink"
                : "bg-surface-2 border-hairline text-muted-ink hover:text-ink hover:border-white/30"
            )}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X size={18} strokeWidth={2.5} />
            ) : (
              <Menu size={18} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden mx-2 mb-2 bg-surface border border-hairline rounded-xl shadow-xl shadow-black/30 overflow-hidden">
          <div className="px-4 py-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-between py-3 text-[15px] font-medium border-b border-hairline/40 last:border-0",
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
                    onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                  >
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </Button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href="/auth">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-hairline text-ink h-10"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/auth?tab=register">
                    <Button
                      size="sm"
                      className="w-full bg-primary text-primary-foreground h-10"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Get Started <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
