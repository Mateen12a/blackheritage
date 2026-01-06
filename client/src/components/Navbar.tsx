import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoImg from "../assets/logo.png";

export function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (location.startsWith("/admin")) {
    return null;
  }

  const links = [
    { href: "/", label: "Home" },
    { href: "/events", label: "Events" },
    { href: "/calendar", label: "Calendar" },
  ];

  if (user) {
    links.push({ href: "/my-tickets", label: "My Tickets" });
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-[40] bg-background/80 backdrop-blur-xl border-b border-white/5 shadow-2xl h-24">
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 flex items-center justify-center">
              <img
                src={logoImg}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold font-display tracking-wide group-hover:text-primary transition-colors uppercase">
                Black Heritage
              </h1>
              <span className="text-[10px] uppercase tracking-[0.2em] text-primary group-hover:text-white transition-colors">
                Events & Entertainment
              </span>
            </div>
          </div>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              <span
                className={`text-sm font-medium tracking-wide cursor-pointer transition-colors hover:text-primary ${
                  location === link.href
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {link.label}
              </span>
            </Link>
          ))}
        </div>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              {(user.role === 'admin' || user.isAdmin) && (
                <Link href="/admin">
                  <Button variant="ghost" className="text-primary hover:bg-primary/10">Go to Admin Portal</Button>
                </Link>
              )}
              <Button variant="ghost" className="text-white hover:text-red-500" onClick={() => logout()}>
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
            </div>
          ) : (
            <Link href="/events">
              <Button className="bg-primary text-background hover:bg-primary/90 font-semibold rounded-full px-6">
                Buy Tickets
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-white"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-card border-b border-white/10 overflow-hidden"
          >
            <div className="p-4 flex flex-col gap-4">
              {links.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block py-2 text-lg font-medium cursor-pointer ${
                      location === link.href
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              ))}
              <div className="h-px bg-white/10 my-2" />
              {user && (
                <Button variant="ghost" className="w-full text-white justify-start" onClick={() => { logout(); setIsMobileMenuOpen(false); }}>
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </Button>
              )}
              <Link href="/events">
                <Button className="w-full bg-primary text-background font-bold" onClick={() => setIsMobileMenuOpen(false)}>
                  Buy Tickets
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
