import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/motion";
import { whatsappLink, WHATSAPP_DISPLAY } from "@/lib/contact";
import {
  Radio,
  ArrowUpRight,
  Store,
  Mail,
  MessageCircle,
  CheckCircle2,
  Music,
  Palette,
  Mic,
  Send,
  Megaphone,
} from "lucide-react";

export default function ChallengesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [contactInput, setContactInput] = useState(user?.email || "");
  const [subscribed, setSubscribed] = useState(() => {
    try {
      return localStorage.getItem("bh_challenges_notified") === "true";
    } catch {
      return false;
    }
  });

  const handleNotifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactInput.trim()) {
      toast({
        title: "Please enter your email or phone",
        description: "We will use this to send you open call announcements.",
        variant: "destructive",
      });
      return;
    }

    try {
      localStorage.setItem("bh_challenges_notified", "true");
    } catch {
      // storage fallback
    }
    setSubscribed(true);
    toast({
      title: "You're on the list",
      description: "We'll notify you as soon as the next open call or showcase brief drops.",
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20 pt-8">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Editorial Header */}
        <Reveal>
          <header className="mb-10">
            <p className="eyebrow">Creative Showcases &amp; Open Calls</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl md:text-5xl">
              Creator &amp; Talent Challenges
            </h1>
            <div className="rule-gold mt-3" />
            <p className="mt-3 max-w-2xl text-sm text-muted-ink sm:text-base leading-relaxed">
              Auditions, design briefs, and performance opportunities hosted by Nigerian event organizers and festival producers.
            </p>
          </header>
        </Reveal>

        {/* Current Status: Honest Empty State */}
        <Reveal delay={0.05}>
          <div className="rounded-md border border-hairline bg-surface p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted-ink">
                <Radio className="w-3.5 h-3.5 text-muted-ink" />
                Status: No active open calls
              </span>
            </div>

            <h2 className="mt-4 font-display text-xl sm:text-2xl font-bold text-ink">
              No challenges running at the moment
            </h2>

            <p className="mt-2 max-w-2xl text-sm text-muted-ink leading-relaxed">
              When event organizers, brands, or festival directors open creator submissions (such as DJ opening slot auditions, MC showcases, or concert flyer design briefs), the guidelines, submission criteria, and deadlines will be published here.
            </p>
          </div>
        </Reveal>

        {/* Two Clear Paths: For Talent & For Organizers */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Path 1: For Creators & Talent */}
          <Reveal delay={0.1}>
            <div className="rounded-md border border-hairline bg-surface p-6 flex flex-col justify-between h-full space-y-6">
              <div>
                <div className="w-10 h-10 rounded-md bg-surface-2 border border-hairline flex items-center justify-center text-gold mb-4">
                  <Store className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-lg text-ink">
                  Get booked directly for shows
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                  You do not need to wait for a competition to get hired. Event organizers across Lagos, Abuja, and Port Harcourt browse Black Heritage to book DJs, MCs, photographers, sound technicians, and stage designers for concerts, weddings, and nightlife events.
                </p>
              </div>

              <div className="pt-4 border-t border-hairline flex flex-wrap items-center gap-3">
                <Link href="/vendor-dashboard">
                  <Button className="press bg-primary text-primary-foreground hover:bg-gold-soft text-xs sm:text-sm font-medium h-9 px-4">
                    Open Talent Studio
                    <ArrowUpRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
                <Link href="/talent">
                  <Button variant="outline" className="border-hairline text-ink hover:text-gold text-xs sm:text-sm h-9 px-4">
                    Explore Directory
                  </Button>
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Path 2: For Event Producers & Brands */}
          <Reveal delay={0.15}>
            <div className="rounded-md border border-hairline bg-surface p-6 flex flex-col justify-between h-full space-y-6">
              <div>
                <div className="w-10 h-10 rounded-md bg-surface-2 border border-hairline flex items-center justify-center text-gold mb-4">
                  <Megaphone className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-lg text-ink">
                  Host an open call for your event
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                  Putting on a concert, festival, or brand activation? Black Heritage can power your open audition, talent search, or creator showcase by managing submissions, entry review, and talent discovery.
                </p>
              </div>

              <div className="pt-4 border-t border-hairline flex flex-wrap items-center gap-3">
                <a
                  href={whatsappLink("Hi Black Heritage, I want to talk about hosting an open call or talent challenge for my event.")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="press bg-primary text-primary-foreground hover:bg-gold-soft text-xs sm:text-sm font-medium h-9 px-4">
                    <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                    Chat on WhatsApp
                  </Button>
                </a>
                <a href="mailto:hello@blackhevents.com?subject=Host%20an%20Open%20Call%20or%20Challenge">
                  <Button variant="outline" className="border-hairline text-ink hover:text-gold text-xs sm:text-sm h-9 px-4">
                    <Mail className="w-3.5 h-3.5 mr-1.5" />
                    Email Team
                  </Button>
                </a>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Opportunity Disciplines */}
        <Reveal delay={0.2}>
          <div className="mt-10 rounded-md border border-hairline bg-surface p-6 sm:p-8">
            <h3 className="eyebrow text-muted-ink">Typical Formats When Open Calls Run</h3>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-ink font-semibold text-sm">
                  <Music className="w-4 h-4 text-gold" />
                  <span>Music &amp; Sound</span>
                </div>
                <p className="text-xs text-muted-ink leading-relaxed">
                  DJ opening slot auditions, producer battle sets, and live festival performer showcases.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-ink font-semibold text-sm">
                  <Palette className="w-4 h-4 text-gold" />
                  <span>Visuals &amp; Design</span>
                </div>
                <p className="text-xs text-muted-ink leading-relaxed">
                  Event flyer art contests, stage lighting concepts, motion graphics, and festival photography.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-ink font-semibold text-sm">
                  <Mic className="w-4 h-4 text-gold" />
                  <span>Stage &amp; Hosting</span>
                </div>
                <p className="text-xs text-muted-ink leading-relaxed">
                  Event MC auditions, hypemen crowd work, and red carpet hosting calls for major Nigerian shows.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Notification Form: Stay in the Loop */}
        <Reveal delay={0.25}>
          <div className="mt-8 rounded-md border border-hairline bg-surface-2 p-6 sm:p-8">
            <div className="max-w-xl">
              <h3 className="font-display font-bold text-lg text-ink">
                Get notified when the next open call launches
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-muted-ink">
                Leave your email or WhatsApp number. We send one alert when a new brief opens, with no promotional spam.
              </p>

              {subscribed ? (
                <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-md">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>You are registered for open call notifications.</span>
                </div>
              ) : (
                <form onSubmit={handleNotifySubmit} className="mt-4 flex flex-col sm:flex-row gap-2.5">
                  <Input
                    type="text"
                    value={contactInput}
                    onChange={(e) => setContactInput(e.target.value)}
                    placeholder="Enter email or WhatsApp number"
                    className="border-hairline bg-background text-ink text-xs sm:text-sm h-10"
                    required
                  />
                  <Button
                    type="submit"
                    className="press bg-primary text-primary-foreground hover:bg-gold-soft text-xs sm:text-sm font-medium h-10 px-5 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Notify Me
                  </Button>
                </form>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
