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
  X
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const menuItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/events", label: "Events", icon: CalendarDays },
    { href: "/admin/bookings", label: "Bookings", icon: Ticket },
    { href: "/admin/sponsors", label: "Sponsors", icon: Users },
    { href: "/admin/vendors", label: "Vendors / Sellers", icon: Store },
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
        className="fixed top-4 left-4 z-[60] md:hidden bg-primary text-background p-2 rounded-lg shadow-lg"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? <ChevronRight size={24} /> : <X size={24} />}
      </button>

      <aside 
        className={cn(
          "fixed left-0 top-0 h-screen bg-card border-r border-white/5 transition-all duration-300 z-50 flex flex-col",
          isCollapsed ? "-translate-x-full md:translate-x-0 md:w-16" : "translate-x-0 w-64"
        )}
      >
      <div className="p-4 flex items-center justify-between border-b border-white/5 h-20">
        {!isCollapsed && (
          <span className="font-display font-bold text-primary tracking-wider uppercase truncate">
            Admin Portal
          </span>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-muted-foreground hover:text-white ml-auto"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </Button>
      </div>

      <nav className="flex-1 py-6 space-y-2 px-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all group",
                  isActive 
                    ? "bg-primary text-background" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon size={20} className={cn("shrink-0", isActive ? "text-background" : "group-hover:text-primary")} />
                {!isCollapsed && <span className="font-medium">{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5 space-y-2">
        <Link href="/">
          <Button 
            variant="ghost" 
            className={cn(
              "w-full text-muted-foreground hover:text-primary hover:bg-primary/10 justify-start px-3",
              isCollapsed && "justify-center px-0"
            )}
          >
            <Globe size={20} className="shrink-0" />
            {!isCollapsed && <span className="ml-3">View Public Site</span>}
          </Button>
        </Link>
        <Button 
          variant="ghost" 
          className={cn(
            "w-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 justify-start px-3",
            isCollapsed && "justify-center px-0"
          )}
          onClick={() => logout()}
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span className="ml-3">Logout</span>}
        </Button>
      </div>
    </aside>
  );
}
