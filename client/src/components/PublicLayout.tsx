import React from "react";
import { Navbar } from "@/components/Navbar";

interface PublicLayoutProps {
  children: React.ReactNode;
  /** Skip the default navbar; the page renders its own (e.g. branded event pages). */
  noNavbar?: boolean;
}

export function PublicLayout({ children, noNavbar = false }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {!noNavbar && <Navbar />}
      {/* mt-20 clears the fixed platform navbar; pages that render their
          own navbar (event pages) start flush so the flyer sits under it. */}
      <main className={noNavbar ? "flex-1" : "flex-1 mt-20"}>
        {children}
      </main>
    </div>
  );
}
