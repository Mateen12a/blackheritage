import React from "react";
import { Navbar } from "@/components/Navbar";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 mt-24">
        {children}
      </main>
    </div>
  );
}
