import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion";
import {
  ShieldCheck,
  Zap,
  ArrowUpRight,
  CheckCircle,
  Download,
  Flame,
  Smartphone,
  CreditCard,
  Building2,
  Users,
  ChevronDown,
  ChevronUp,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface LeadFormState {
  name: string;
  brandName: string;
  whatsapp: string;
  email: string;
  city: string;
  estimatedAttendance: string;
}

const FAQS = [
  {
    q: "How fast do ticket payouts land in my Nigerian bank account?",
    a: "Payouts settle within 24 hours of ticket sales. You can connect any Nigerian commercial bank or fintech account (GTBank, Zenith, Access, Kuda, Providus) directly from your organizer settings.",
  },
  {
    q: "Can bouncers scan tickets if mobile network drops at the venue?",
    a: "Yes. The Black Heritage Gate Portal caches ticket hashes in the browser. Your bouncers and entry team can scan QR codes offline with zero lag, and check-ins sync automatically once connection returns.",
  },
  {
    q: "Can I issue VIP tables and private guestlists without paying fees?",
    a: "Yes. From your organizer dashboard you can issue unlimited complimentary passes, sponsor wristbands, and artist guestlists with zero platform fees.",
  },
  {
    q: "How does the 0% fee on the first 100 tickets work?",
    a: "When you download the Playbook or register with code FOUNDER100, Black Heritage waives the 6% platform fee on your first 100 paid tickets. You only cover the standard Paystack payment processing fee.",
  },
];

const TRUST_LOGOS = [
  { name: "Mainland Block Party", slug: "mainland-block-party" },
  { name: "Alte Culture Circle", slug: "alte-culture-circle" },
  { name: "Native Sound System", slug: "native-sound-system" },
  { name: "Sip & Paint .NG", slug: "sip-and-paint-ng" },
  { name: "Tunde Live Concepts", slug: "tunde-live" },
];

export default function OrganizersLanding() {
  const { toast } = useToast();

  // Interactive Calculator State
  const [attendees, setAttendees] = useState(800);
  const [ticketPrice, setTicketPrice] = useState(10000);

  // Lead Form State
  const [formData, setFormData] = useState<LeadFormState>({
    name: "",
    brandName: "",
    whatsapp: "",
    email: "",
    city: "Lagos",
    estimatedAttendance: "500-1500",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Calculations
  const grossRevenue = attendees * ticketPrice;
  const bhFee = Math.round(grossRevenue * 0.06);
  const legacyFee = Math.round(grossRevenue * 0.10);
  const totalSavings = legacyFee - bhFee;

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.brandName || !formData.whatsapp || !formData.email) {
      toast({
        title: "Required Fields Missing",
        description: "Please enter your name, brand name, WhatsApp number, and email.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit request");
      }

      setSubmitted(true);
      toast({
        title: "Playbook Unlocked",
        description: "Your 0% fee promo code FOUNDER100 is ready to use.",
      });
    } catch (err: any) {
      toast({
        title: "Submission Failed",
        description: err.message || "Please check your network and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Hero Section ─── */}
      <section className="relative overflow-hidden pt-12 md:pt-18 pb-16 md:pb-24 border-b border-hairline">
        {/* Ambient radial glow */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 -translate-x-1/2 w-[800px] h-[450px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 55% 45% at 50% 20%, rgba(227,178,60,0.15) 0%, transparent 70%)",
          }}
        />

        <div className="container relative z-10 max-w-5xl mx-auto px-4 text-center">
          <Reveal y={14} duration={0.5}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface/80 border border-gold/30 text-gold text-xs font-semibold uppercase tracking-wider mb-6">
              <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              For Nigerian Event Promoters & Cultural Curators
            </div>
          </Reveal>

          <Reveal y={18} delay={0.1} duration={0.6}>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-ink leading-[1.08] tracking-tight">
              The Event OS Built for Nigeria&apos;s Cultural Creators
            </h1>
          </Reveal>

          <Reveal y={16} delay={0.25} duration={0.6}>
            <p className="mt-6 mx-auto max-w-2xl text-base sm:text-lg text-ink/80 leading-relaxed">
              Stop losing ticket revenue to gate fraud and delayed payouts. Instant WhatsApp QR delivery, 24-hour bank settlements, offline bouncer scanning, and your own custom branded hub.
            </p>
          </Reveal>

          <Reveal y={14} delay={0.35} duration={0.55}>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth?mode=register&role=organizer">
                <Button className="press h-13 px-8 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-sm rounded-full w-full sm:w-auto shadow-lg shadow-gold/10">
                  Start Selling Tickets · 0% on First 100
                  <ArrowUpRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
              <a href="#playbook-form">
                <Button
                  variant="outline"
                  className="press h-13 px-7 border-white/20 bg-white/5 text-ink hover:bg-white/10 hover:text-gold font-medium text-sm rounded-full w-full sm:w-auto backdrop-blur-sm"
                >
                  <Download className="w-4 h-4 mr-2 text-gold" />
                  Get Free Gate Fraud Playbook
                </Button>
              </a>
            </div>
          </Reveal>

          {/* Key Metrics Strip */}
          <Reveal y={12} delay={0.45} duration={0.55}>
            <div className="mt-14 pt-8 border-t border-hairline/80 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <p className="font-display text-2xl sm:text-3xl font-bold text-gold tabular-nums">0%</p>
                <p className="text-xs text-muted-ink mt-1 font-medium">Gate Pass-back Fraud</p>
              </div>
              <div>
                <p className="font-display text-2xl sm:text-3xl font-bold text-gold tabular-nums">&lt; 0.2s</p>
                <p className="text-xs text-muted-ink mt-1 font-medium">Offline Scanner Speed</p>
              </div>
              <div>
                <p className="font-display text-2xl sm:text-3xl font-bold text-gold tabular-nums">24h</p>
                <p className="text-xs text-muted-ink mt-1 font-medium">Direct Bank Settlement</p>
              </div>
              <div>
                <p className="font-display text-2xl sm:text-3xl font-bold text-gold tabular-nums">6%</p>
                <p className="text-xs text-muted-ink mt-1 font-medium">Flat Fee vs 10%+ Legacy</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Social Proof: Curators on Black Heritage ─── */}
      <section className="py-12 bg-surface/30 border-b border-hairline">
        <div className="container max-w-5xl mx-auto px-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-muted-ink mb-6">
            Curated by Nigeria&apos;s Leading Cultural Collectives
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {TRUST_LOGOS.map((org) => (
              <Link key={org.slug} href={"/o/" + org.slug}>
                <span className="font-display text-sm sm:text-base font-semibold text-ink/70 hover:text-gold transition-colors cursor-pointer border border-hairline/60 bg-surface/50 px-4 py-2 rounded-full">
                  {org.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why Switch from Legacy Portals ─── */}
      <section className="py-16 md:py-24 border-b border-hairline">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="eyebrow">The Competitive Edge</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl font-bold text-ink">
              Why Nigeria&apos;s Best Organizers Are Switching
            </h2>
            <p className="mt-3 text-sm text-muted-ink">
              Built specifically for the realities of the Lagos and Nigerian nightlife economy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-surface border border-hairline relative">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold mb-4">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">Instant WhatsApp Ticket Passes</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                Nigerian attendees check WhatsApp 10x more than email. Tickets and QR codes deliver directly to WhatsApp in 3 seconds. Zero lost tickets at the gate.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface border border-hairline relative">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">Zero-Lag Offline Bouncer Scanner</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                Network always fails at beach clubs and packed venues. Our free scanner checks tickets offline in under 0.2 seconds and alerts on duplicate or pass-back attempts.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface border border-hairline relative">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold mb-4">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">Next-Day Direct Bank Settlements</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                No 14-day hold times. Ticket revenue lands in your Nigerian bank account within 24 hours so you can pay stage sound and vendors on schedule.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface border border-hairline relative">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold mb-4">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">Your Own Branded Hub</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                Share a luxury link (blackhevents.com/o/yourbrand) with your video backdrop, Spotify playlist, and zero banner ads for competitor events.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface border border-hairline relative">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">100% Fan Ownership & CRM</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                Export verified attendee phone numbers and emails anytime. Retarget past attendees for your next tour stop via 1-tap WhatsApp broadcasts.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface border border-hairline relative">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold mb-4">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">Flat 6% vs 10%+ Legacy Fees</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                Keep thousands of Naira more per event. Transparent flat rate, zero hidden maintenance deductions, and free gate staff accounts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Interactive Ticket Revenue & Savings Calculator ─── */}
      <section className="py-16 md:py-24 bg-surface/20 border-b border-hairline">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="text-center max-w-xl mx-auto mb-10">
            <p className="eyebrow">Financial Impact</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink">
              Calculate Your Ticket Earnings & Savings
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-ink">
              See what you keep with Black Heritage compared to traditional 10% ticketing portals.
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-hairline shadow-2xl">
            <div className="space-y-6">
              {/* Attendees Slider */}
              <div>
                <div className="flex justify-between items-center text-sm font-medium mb-2">
                  <span className="text-ink">Expected Attendees</span>
                  <span className="text-gold font-bold tabular-nums text-base">{attendees.toLocaleString()} people</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={50}
                  value={attendees}
                  onChange={(e) => setAttendees(Number(e.target.value))}
                  className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-gold"
                />
                <div className="flex justify-between text-[11px] text-muted-ink mt-1">
                  <span>100</span>
                  <span>1,500</span>
                  <span>3,000</span>
                  <span>5,000+</span>
                </div>
              </div>

              {/* Average Ticket Price */}
              <div>
                <div className="flex justify-between items-center text-sm font-medium mb-2">
                  <span className="text-ink">Average Ticket Price</span>
                  <span className="text-gold font-bold tabular-nums text-base">₦{ticketPrice.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min={2000}
                  max={50000}
                  step={1000}
                  value={ticketPrice}
                  onChange={(e) => setTicketPrice(Number(e.target.value))}
                  className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-gold"
                />
                <div className="flex justify-between text-[11px] text-muted-ink mt-1">
                  <span>₦2,000</span>
                  <span>₦15,000</span>
                  <span>₦30,000</span>
                  <span>₦50,000</span>
                </div>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="mt-8 pt-6 border-t border-hairline grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-xl bg-surface-2/60 border border-hairline/60">
                <p className="text-xs text-muted-ink">Total Gross Sales</p>
                <p className="text-xl sm:text-2xl font-bold font-display text-ink mt-1 tabular-nums">
                  ₦{grossRevenue.toLocaleString()}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-2/60 border border-hairline/60">
                <p className="text-xs text-muted-ink">Traditional Portal Fee (10%)</p>
                <p className="text-xl sm:text-2xl font-bold font-display text-destructive mt-1 tabular-nums">
                  ₦{legacyFee.toLocaleString()}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gold/10 border border-gold/30">
                <p className="text-xs text-gold font-semibold uppercase tracking-wider">You Save with Black Heritage</p>
                <p className="text-xl sm:text-2xl font-bold font-display text-gold mt-1 tabular-nums">
                  ₦{totalSavings.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link href="/auth?mode=register&role=organizer">
                <Button className="press h-12 px-8 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-sm rounded-full">
                  Keep More of Your Money · Register Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Lead Magnet Section: The 2026 Playbook ─── */}
      <section id="playbook-form" className="py-16 md:py-24 border-b border-hairline relative">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="rounded-2xl bg-surface border border-gold/40 p-6 sm:p-10 relative overflow-hidden shadow-2xl">
            <div
              aria-hidden="true"
              className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-gold/10 blur-3xl pointer-events-none"
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Playbook Overview */}
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/15 text-gold text-xs font-semibold uppercase tracking-wider mb-4">
                  <Flame className="w-3.5 h-3.5" />
                  Free Promoter Resource & Voucher
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink leading-tight">
                  The 2026 Nigeria Event Production & Zero-Gate-Fraud Playbook
                </h2>
                <p className="mt-3 text-xs sm:text-sm text-ink/80 leading-relaxed">
                  The exact operational framework used by top Lagos and Abuja festival organizers to eliminate gate pass-backs, avoid ticket duplication, and pack their venue before midnight.
                </p>

                <div className="mt-5 space-y-2.5">
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-ink/90">
                    <CheckCircle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                    <span>The 12-point bouncer gate checklist to stop fake QR codes</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-ink/90">
                    <CheckCircle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                    <span>Sponsor pitch deck structure that lands corporate alcohol and bank partnerships</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-ink/90">
                    <CheckCircle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                    <span>Instant voucher: 0% platform fee on your first 100 tickets</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Lead Form */}
              <div className="lg:col-span-5 bg-surface-2 p-5 sm:p-6 rounded-xl border border-hairline">
                {submitted ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-gold/20 text-gold flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-ink">You are In</h3>
                    <p className="text-xs text-ink/80 mt-1">
                      Check your WhatsApp for the direct download link. Your voucher code <span className="font-mono text-gold font-bold">FOUNDER100</span> is unlocked.
                    </p>
                    <div className="mt-4 pt-4 border-t border-hairline">
                      <Link href="/auth?mode=register&role=organizer">
                        <Button className="press w-full h-11 bg-primary text-primary-foreground font-semibold text-xs rounded-full">
                          Create Your Organizer Hub Now
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitLead} className="space-y-3.5">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-ink uppercase tracking-wider block mb-1">
                        Your Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Tunde Adebayo"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg bg-surface border border-hairline text-ink text-xs focus:outline-none focus:border-gold"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-ink uppercase tracking-wider block mb-1">
                        Brand or Collective Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Island Rave Collective"
                        value={formData.brandName}
                        onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg bg-surface border border-hairline text-ink text-xs focus:outline-none focus:border-gold"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-ink uppercase tracking-wider block mb-1">
                        WhatsApp Phone Number
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 0803 123 4567"
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg bg-surface border border-hairline text-ink text-xs focus:outline-none focus:border-gold"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-ink uppercase tracking-wider block mb-1">
                        Work Email
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="tunde@islandrave.ng"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full h-10 px-3 rounded-lg bg-surface border border-hairline text-ink text-xs focus:outline-none focus:border-gold"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-ink uppercase tracking-wider block mb-1">
                          Primary City
                        </label>
                        <select
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="w-full h-10 px-2 rounded-lg bg-surface border border-hairline text-ink text-xs focus:outline-none focus:border-gold"
                        >
                          <option value="Lagos">Lagos</option>
                          <option value="Abuja">Abuja</option>
                          <option value="Port Harcourt">Port Harcourt</option>
                          <option value="London">London (Diaspora)</option>
                          <option value="Other">Other City</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-muted-ink uppercase tracking-wider block mb-1">
                          Expected Crowd
                        </label>
                        <select
                          value={formData.estimatedAttendance}
                          onChange={(e) => setFormData({ ...formData, estimatedAttendance: e.target.value })}
                          className="w-full h-10 px-2 rounded-lg bg-surface border border-hairline text-ink text-xs focus:outline-none focus:border-gold"
                        >
                          <option value="Under 500">Under 500</option>
                          <option value="500-1500">500 to 1,500</option>
                          <option value="1500-5000">1,500 to 5,000</option>
                          <option value="5000+">5,000+</option>
                        </select>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="press w-full h-11 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-xs rounded-full mt-2"
                    >
                      {isSubmitting ? "Generating Download..." : "Download Playbook + Claim 0% Fee"}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Frequently Asked Questions ─── */}
      <section className="py-16 md:py-24 border-b border-hairline">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="eyebrow">Clear Answers</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-hairline bg-surface overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4"
                  >
                    <span className="font-display text-base font-bold text-ink">{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-gold shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-ink shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-ink/80 leading-relaxed border-t border-hairline/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Final Bottom CTA ─── */}
      <section className="py-16 md:py-20 text-center">
        <div className="container max-w-3xl mx-auto px-4">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink">
            Ready to Sell Out Your Next Event?
          </h2>
          <p className="mt-3 text-sm text-muted-ink max-w-xl mx-auto">
            Set up your ticket tiers, customize your page link, and start selling passes in under 3 minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth?mode=register&role=organizer">
              <Button className="press h-13 px-8 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-sm rounded-full w-full sm:w-auto">
                Create Free Organizer Account
                <ArrowUpRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <a
              href="https://wa.me/2348000000000?text=Hi%20Black%20Heritage,%20I%20want%20to%20host%20an%20event"
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="outline"
                className="press h-13 px-7 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-medium text-sm rounded-full w-full sm:w-auto"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat with Platform Team
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
