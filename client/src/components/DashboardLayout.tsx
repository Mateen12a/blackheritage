import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useMyVendors } from "@/hooks/use-vendors";
import { useUnreadCount } from "@/hooks/use-messages";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  Compass,
  LayoutDashboard,
  MessageSquare,
  ScanLine,
  Store,
  Ticket,
  LogOut,
  UserCog,
} from "lucide-react";
import { useState } from "react";
import logoImg from "../assets/logo.png";

/**
 * One shell for every logged-in page.
 * Desktop: fixed left sidebar. Mobile: WhatsApp-style bottom tab bar,
 * with account controls in a slide-up sheet.
 */

type Tab = {
  href: string;
  label: string;
  icon: typeof Compass;
  match: (loc: string) => boolean;
};

/**
 * Tabs each account actually reaches. Every tab must pass the route guards in
 * App.tsx or it becomes a link that bounces the user back. Five tabs is the
 * ceiling for a legible bottom bar.
 */
function tabsFor(role?: string, isAdmin?: boolean, isTeamStaff?: boolean, isVendor?: boolean): Tab[] {
  const isOrg = role === "admin" || role === "organizer" || isAdmin;

  // Organizer team staff (entry, finance, manager): the gate portal is the
  // job. Their own attendee dashboard stays one tap away.
  if (isTeamStaff) {
    return [
      {
        href: "/verify",
        label: "Verify",
        icon: ScanLine,
        match: (loc) => loc.startsWith("/verify"),
      },
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        match: (loc) => loc === "/dashboard" || /^\/dashboard\/.+/.test(loc),
      },
    ];
  }

  if (isOrg) {
    return [
      {
        href: "/",
        label: "Explore",
        icon: Compass,
        match: (loc) =>
          loc === "/" || loc.startsWith("/events") || loc.startsWith("/vendors"),
      },
      {
        href: "/admin",
        label: "Dashboard",
        icon: LayoutDashboard,
        match: (loc) => loc.startsWith("/admin"),
      },
      {
        href: "/verify",
        label: "Verify",
        icon: ScanLine,
        match: (loc) => loc.startsWith("/verify"),
      },
      {
        href: "/messages",
        label: "Chats",
        icon: MessageSquare,
        match: (loc) => loc.startsWith("/messages"),
      },
      {
        href: "/vendor-dashboard",
        label: "Vendor",
        icon: Store,
        match: (loc) => loc.startsWith("/vendor-dashboard"),
      },
    ];
  }

  // Attendees and vendor owners. Verify is staff-only upstream, so it
  // deliberately does not appear here.
  return [
    {
      href: "/",
      label: "Explore",
      icon: Compass,
      match: (loc) =>
        loc === "/" || loc.startsWith("/events") || loc.startsWith("/vendors"),
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      match: (loc) => loc === "/dashboard" || /^\/dashboard\/.+/.test(loc),
    },
    {
      href: "/my-tickets",
      label: "Tickets",
      icon: Ticket,
      match: (loc) => loc.startsWith("/my-tickets"),
    },
    {
      href: "/messages",
      label: "Chats",
      icon: MessageSquare,
      match: (loc) => loc.startsWith("/messages"),
    },
    // My Shop only appears once a vendor profile exists. Guests and attendees
    // get the invitation from the vendors directory instead of a dead tab.
    ...(isVendor
      ? [{
          href: "/vendor-dashboard",
          label: "My Shop",
          icon: Store,
          match: (loc: string) => loc.startsWith("/vendor-dashboard"),
        }]
      : []),
  ];
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);

  const isAdmin = user?.role === "admin" || user?.isAdmin;
  const isOrg = isAdmin || user?.role === "organizer";
  const isTeamStaff = !!user?.teamOwnerId;
  const { data: myVendors } = useMyVendors(!!user);
  const isVendor = !!myVendors && myVendors.length > 0;
  const tabs = tabsFor(user?.role, isAdmin, isTeamStaff, isVendor);
  const unread = useUnreadCount();
  const isTabActive = (tab: Tab) => tab.match(location);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* ── Desktop sidebar: floating inset panel ── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col z-40 p-3">
        <div className="flex flex-col flex-1 rounded-2xl border border-hairline bg-surface shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
          <Link
            href="/"
            aria-label="Black Heritage Events home"
            className="flex items-center gap-2.5 h-[64px] px-5 border-b border-hairline shrink-0"
          >
            <img src={logoImg} alt="" className="h-8 w-8 object-contain" />
            <span className="flex flex-col leading-none gap-0.5">
              <span className="font-display text-[15px] font-bold tracking-wide text-ink">
                Black Heritage
              </span>
              <span className="text-[8px] font-bold tracking-[0.18em] uppercase text-muted-ink">
                Events
              </span>
            </span>
          </Link>

          <nav aria-label="Account navigation" className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = isTabActive(tab);
              return (
                <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer",
                      active
                        ? "text-gold bg-gold/10"
                        : "text-muted-ink hover:text-ink hover:bg-surface-2"
                    )}
                  >
                    <Icon size={18} strokeWidth={active ? 2 : 1.5} aria-hidden="true" />
                    <span className="text-sm font-medium">{tab.label}</span>
                    {tab.href === "/messages" && unread > 0 && (
                      <span className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-hairline p-3 shrink-0">
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-2 transition-colors text-left"
              aria-haspopup="dialog"
            >
              <span className="w-8 h-8 rounded-full bg-surface-2 border border-hairline flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-gold uppercase">
                  {(user?.username || "U").charAt(0)}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink truncate">
                  {user?.username}
                </span>
                <span className="block text-[11px] text-muted-ink capitalize">
                  {isOrg ? "Organizer" : isVendor ? "Vendor" : "Attendee"}
                </span>
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex-1 min-w-0 md:ml-64 flex flex-col">
        {/* Slim mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 border-b border-hairline bg-background/90 backdrop-blur-xl">
          <div className="h-14 px-4 flex items-center justify-between">
            <Link href="/" aria-label="Black Heritage Events home" className="flex items-center gap-2">
              <img src={logoImg} alt="" className="h-7 w-7 object-contain" />
              <span className="font-display text-sm font-bold tracking-wide text-ink">
                Black Heritage
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              aria-label="Open account menu"
              aria-haspopup="dialog"
              className="w-9 h-9 rounded-full bg-surface-2 ring-2 ring-gold/60 ring-offset-2 ring-offset-background active:scale-95 transition-transform flex items-center justify-center"
            >
              <span className="text-xs font-bold text-gold uppercase">
                {(user?.username || "U").charAt(0)}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-10 py-8 md:py-10 pb-28 md:pb-16">
          {children}
        </main>

        {/* ── Mobile bottom tab bar: floating pill ── */}
        <nav
          aria-label="Primary"
          className="md:hidden fixed bottom-0 inset-x-0 z-40"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <div
            className="mx-3 rounded-full border border-hairline bg-surface/95 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
          <div
            className="grid h-16 px-1"
            style={{ gridTemplateColumns: `repeat(${Math.min(tabs.length, 5)}, minmax(0, 1fr))` }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = isTabActive(tab);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "mx-0.5 my-1.5 flex flex-col items-center justify-center gap-1 rounded-2xl transition-colors active:bg-surface-2",
                    active ? "bg-gold/15 text-gold" : "text-muted-ink"
                  )}
                >
                  <span className="relative flex items-center justify-center">
                    <Icon size={20} strokeWidth={active ? 2 : 1.5} aria-hidden="true" />
                    {tab.href === "/messages" && unread > 0 && (
                      <span
                        aria-label={unread + " unread messages"}
                        className="absolute -top-1 -right-2 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center"
                      >
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
                </Link>
              );
            })}
          </div>
          </div>
        </nav>
      </div>

      {/* ── Account sheet (mobile + desktop trigger) ── */}
      <Sheet open={accountOpen} onOpenChange={setAccountOpen}>
        <SheetContent
          side="bottom"
          className="bg-surface border-hairline rounded-t-2xl px-6 pt-4 pb-8 max-h-[70vh] flex flex-col md:inset-x-auto md:left-5 md:bottom-5 md:w-80 md:rounded-xl md:border md:max-h-none"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-hairline md:hidden" aria-hidden="true" />
          <SheetTitle className="sr-only">Account</SheetTitle>

          <div className="flex items-center gap-3 py-4 border-b border-hairline">
            <span className="w-11 h-11 rounded-full bg-surface-2 border border-hairline flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-gold uppercase">
                {(user?.username || "U").charAt(0)}
              </span>
            </span>
            <div className="min-w-0">
              <p className="font-display text-base font-bold text-ink truncate">
                {user?.username}
              </p>
              <p className="text-xs text-muted-ink capitalize">
                {isOrg ? "Organizer" : isVendor ? "Vendor" : "Attendee"} account
              </p>
            </div>
          </div>

          <nav aria-label="Account" className="flex-1 overflow-y-auto py-3 md:hidden">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.href}
                  type="button"
                  onClick={() => {
                    setAccountOpen(false);
                    navigate(tab.href);
                  }}
                  className="w-full flex items-center gap-3 px-2 py-3 rounded-md text-muted-ink hover:text-ink hover:bg-surface-2 transition-colors text-left"
                >
                  <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-hairline space-y-1">
            <button
              type="button"
              onClick={() => {
                setAccountOpen(false);
                navigate("/settings");
              }}
              className="w-full flex items-center gap-3 px-2 py-3 rounded-md text-muted-ink hover:text-ink hover:bg-surface-2 transition-colors text-left"
            >
              <UserCog size={18} strokeWidth={1.5} aria-hidden="true" />
              <span className="text-sm font-medium">Account settings</span>
            </button>
            <Button
              variant="ghost"
              onClick={() => logout()}
              className="w-full justify-center text-muted-ink hover:text-ink hover:bg-surface-2"
            >
              <LogOut size={16} className="mr-2" aria-hidden="true" />
              Sign Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
