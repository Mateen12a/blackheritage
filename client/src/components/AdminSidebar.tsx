import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  CalendarDays,
  Ticket,
  Users,
  Store,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Globe,
  X,
  Megaphone,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const isAdmin = user?.role === "admin";

  const menuItems = [
    {
      href: "/admin",
      label: isAdmin ? "Platform Overview" : "Dashboard",
      icon: LayoutDashboard,
    },
    { href: "/admin/events", label: "Events", icon: CalendarDays },
    { href: "/admin/vendors", label: "Vendors", icon: Store },
  ];

  if (isAdmin) {
    menuItems.push({ href: "/admin/bookings", label: "Bookings", icon: Ticket });
    menuItems.push({
      href: "/admin/sponsors",
      label: "Sponsors",
      icon: Users,
    });
  }

  const externalItems = [
    { href: "/vendors", label: "Public Directory", icon: Megaphone },
    { href: "/vendor-dashboard", label: "My Vendor Profile", icon: Store },
  ];

  return (
    <>
      {/* Mobile Toggle Button */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}
      <button
        className={cn(
          "fixed bottom-6 right-6 z-[60] md:hidden bg-primary text-gold-well p-4 rounded-full shadow-2xl transition-all duration-300",
          !isCollapsed
            ? "opacity-0 pointer-events-none scale-0"
            : "opacity-100 scale-100"
        )}
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label="Open admin menu"
      >
        <LayoutDashboard size={24} />
      </button>

      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-surface border-r border-hairline transition-all duration-300 z-50 flex flex-col",
          isCollapsed
            ? "-translate-x-full md:translate-x-0 md:w-16"
            : "translate-x-0 w-64"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b border-hairline h-20">
          {!isCollapsed && (
            <span className="font-display font-bold text-gold tracking-wider text-sm truncate">
              {isAdmin ? "Admin Portal" : "Organizer"}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(true)}
            className="text-muted-ink hover:text-ink ml-auto"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <X size={20} />}
          </Button>
        </div>

        <nav className="flex-1 py-6 space-y-1 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location === item.href ||
              (item.href !== "/admin" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors group",
                    isActive
                      ? "bg-primary/10 text-gold border-l-2 border-gold"
                      : "text-muted-ink hover:bg-surface-2 hover:text-ink border-l-2 border-transparent"
                  )}
                >
                  <Icon
                    size={18}
                    className={cn(
                      "shrink-0",
                      isActive ? "text-gold" : "group-hover:text-gold"
                    )}
                  />
                  {!isCollapsed && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-hairline space-y-1">
          {externalItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full text-muted-ink hover:text-gold hover:bg-gold/5 justify-start px-3 text-sm",
                    isCollapsed && "justify-center px-0"
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  {!isCollapsed && <span className="ml-3">{item.label}</span>}
                </Button>
              </Link>
            );
          })}
          <Link href="/">
            <Button
              variant="ghost"
              className={cn(
                "w-full text-muted-ink hover:text-gold hover:bg-gold/5 justify-start px-3 text-sm",
                isCollapsed && "justify-center px-0"
              )}
            >
              <Globe size={18} className="shrink-0" />
              {!isCollapsed && <span className="ml-3">Public Site</span>}
            </Button>
          </Link>
          <Button
            variant="ghost"
            className={cn(
              "w-full text-muted-ink hover:text-red-400 hover:bg-red-500/5 justify-start px-3 text-sm",
              isCollapsed && "justify-center px-0"
            )}
            onClick={() => logout()}
          >
            <LogOut size={18} className="shrink-0" />
            {!isCollapsed && <span className="ml-3">Sign Out</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}
