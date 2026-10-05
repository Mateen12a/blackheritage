import React from "react";
import { Link } from "wouter";
import logoImg from "@/assets/logo_transparent.png";
import { whatsappLink, WHATSAPP_DISPLAY } from "@/lib/contact";

export const MDEV_CREDIT = "Built by MDEV Collective";

export function Footer() {
  const mdevUrl = import.meta.env.VITE_MDEV_URL;

  return (
    <footer className="border-t border-hairline bg-surface">
      <div className="container mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src={logoImg} alt="" className="h-8 w-8 object-contain" />
              <div className="leading-none">
                <p className="font-display text-lg font-bold text-ink">
                  Black Heritage
                </p>
                <p className="eyebrow mt-1">Entertainment &amp; Events</p>
              </div>
            </div>
            <p className="text-sm text-muted-ink leading-relaxed mt-4">
              Tickets to Nigerian shows and festivals, and the DJs,
              caterers, and photographers who work them.
            </p>
          </div>

          <div>
            <h4 className="eyebrow mb-4">Events</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/events"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">Browse Events</span></Link></li>
              <li><Link href="/calendar"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">Calendar</span></Link></li>
              <li><Link href="/my-tickets"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">My Tickets</span></Link></li>
            </ul>
          </div>

          <div>
            <h4 className="eyebrow mb-4">Vendors</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/vendors"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">Vendor Directory</span></Link></li>
              <li><Link href="/vendor-signup"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">List your profile</span></Link></li>
              <li><Link href="/auth?tab=register"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">Create Account</span></Link></li>
            </ul>
          </div>

          <div>
            <h4 className="eyebrow mb-4">For Organizers</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/admin"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">Organizer Dashboard</span></Link></li>
              <li><Link href="/organizers"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">List an event</span></Link></li>
              <li><Link href="/auth?tab=register"><span className="text-muted-ink hover:text-gold transition-colors cursor-pointer">Sign Up Free</span></Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-hairline">
        <div className="container mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-ink/60">
            <span>
              © {new Date().getFullYear()} Black Heritage Entertainment &amp; Events. All rights reserved.
            </span>
            <span className="opacity-40">•</span>
            <span>
              {mdevUrl ? (
                <a
                  href={mdevUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold transition-colors"
                >
                  {MDEV_CREDIT}
                </a>
              ) : (
                <span>{MDEV_CREDIT}</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-5 text-xs text-muted-ink">
            <a href="https://instagram.com/blackhevents" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors" aria-label="Instagram">Instagram</a>
            <a href="https://x.com/blackhevents" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors" aria-label="Twitter / X">Twitter / X</a>
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors" aria-label={`WhatsApp ${WHATSAPP_DISPLAY}`}>WhatsApp</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
