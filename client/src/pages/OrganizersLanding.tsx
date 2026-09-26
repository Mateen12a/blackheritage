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
import { EMAIL_HINT, isValidEmail } from "@shared/email";
import { errorFromResponse, errorMessage } from "@/lib/errors";
import { whatsappLink } from "@/lib/contact";

// Pre-filled so the first reply from the team has context.
const CHAT_GREETING =
  "Hi Black Heritage, I am organizing an event and want to talk about selling tickets.";

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
    q: "How fast do payouts reach my bank account?",
    a: "Ticket sales settle to your bank account within 24 hours. Add any Nigerian bank or fintech account (GTBank, Zenith, Access, Kuda, Providus) in your organizer settings.",
  },
  {
    q: "Can the gate scan tickets when the network drops?",
    a: "Yes. The gate page saves ticket data in the browser, so your entry team keeps scanning QR codes offline. Check-ins sync on their own when the connection comes back.",
  },
  {
    q: "Do comps and guest lists cost anything?",
    a: "No. Free passes, sponsor wristbands, and artist guest lists cost nothing from your dashboard. You pay the platform fee on paid tickets only.",
  },
  {
    q: "How does the 0% fee on the first 100 tickets work?",
    a: "Download the playbook or sign up with the code FOUNDER100 and we waive the platform fee on your first 100 paid tickets. The payment processor's own charge still applies.",
  },
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
    if (!formData.name.trim() || !formData.brandName.trim() || !formData.whatsapp.trim()) {
      toast({
        title: "A few details are missing",
        description: "Add your name, your brand or collective, and a WhatsApp number.",
        variant: "destructive",
      });
      return;
    }
    if (!isValidEmail(formData.email)) {
      toast({
        title: "Check that email address",
        description: EMAIL_HINT,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, email: formData.email.trim() }),
      });

      if (!res.ok) {
        throw await errorFromResponse(res);
      }

      setSubmitted(true);
      toast({
        title: "Playbook sent",
        description: "Check your email for the PDF. Your code FOUNDER100 is ready to use.",
      });
    } catch (err) {
      toast({
        title: "That did not send",
        description: errorMessage(err, "Check your connection, then try again."),
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
              Sell tickets for your event
            </div>
          </Reveal>

          <Reveal y={18} delay={0.1} duration={0.6}>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-ink leading-[1.08] tracking-tight">
              Sell tickets. Scan the gate. Get paid.
            </h1>
          </Reveal>

          <Reveal y={16} delay={0.25} duration={0.6}>
            <p className="mt-6 mx-auto max-w-2xl text-base sm:text-lg text-ink/80 leading-relaxed">
              Your buyers get their QR code on WhatsApp. Your gate keeps scanning when the network drops. Payouts go to your own bank account, and the attendee list stays yours.
            </p>
          </Reveal>

          <Reveal y={14} delay={0.35} duration={0.55}>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth?mode=register&role=organizer">
                <Button className="press h-13 px-8 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-sm rounded-full w-full sm:w-auto shadow-lg shadow-gold/10">
                  Start selling tickets · 0% on first 100
                  <ArrowUpRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
              <a href="#playbook-form">
                <Button
                  variant="outline"
                  className="press h-13 px-7 border-white/20 bg-white/5 text-ink hover:bg-white/10 hover:text-gold font-medium text-sm rounded-full w-full sm:w-auto backdrop-blur-sm"
                >
                  <Download className="w-4 h-4 mr-2 text-gold" />
                  Get the free gate-fraud playbook
                </Button>
              </a>
            </div>
          </Reveal>

          {/* Key Metrics Strip */}
          <Reveal y={12} delay={0.45} duration={0.55}>
            <div className="mt-14 pt-8 border-t border-hairline/80 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <p className="font-display text-lg sm:text-xl font-bold text-gold">Offline gate scanning</p>
                <p className="text-xs text-muted-ink mt-1 font-medium">Keeps working when the network drops</p>
              </div>
              <div>
                <p className="font-display text-lg sm:text-xl font-bold text-gold">Duplicate checks</p>
                <p className="text-xs text-muted-ink mt-1 font-medium">One entry per ticket, flagged at the door</p>
              </div>
              <div>
                <p className="font-display text-lg sm:text-xl font-bold text-gold tabular-nums">24h settlement</p>
                <p className="text-xs text-muted-ink mt-1 font-medium">Ticket money straight to your bank</p>
              </div>
              <div>
                <p className="font-display text-lg sm:text-xl font-bold text-gold tabular-nums">6% flat fee</p>
                <p className="text-xs text-muted-ink mt-1 font-medium">No monthly charge</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Event types we serve ─── */}
      <section className="py-16 md:py-24 border-b border-hairline">
        <div className="container max-w-6xl mx-auto px-4">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-gold mb-3">What you can sell tickets for</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl font-bold text-ink">
              From 30-person house parties to 3,000-seat festivals
            </h2>
            <div className="mt-4 h-0.5 w-16 bg-gold" aria-hidden="true" />
          </Reveal>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: "House Parties & Private Events", hint: "Unlisted or invite-only, with a code you share yourself." },
              { title: "Concerts & Festivals", hint: "Public listing, tiered tickets, tables, and a gate crew you can add later." },
              { title: "Weddings & Celebrations", hint: "Your branding on every ticket and invite link." },
              { title: "Corporate Events & Conferences", hint: "Invite-only access codes, a staffed gate, and clean attendee exports." },
              { title: "Comedy Shows & Art Exhibitions", hint: "Seated or standing, promo codes, waitlists." },
              { title: "Brunches & Day Parties", hint: "Set up in minutes, guest checkout, QR codes on WhatsApp." },
            ].map((t, i) => (
              <Reveal key={t.title} delay={0.05 * i}>
                <div className="h-full border border-hairline rounded-md bg-surface p-6 hover:border-white/20 transition-colors duration-200">
                  <h3 className="font-display text-lg font-bold text-ink">{t.title}</h3>
                  <p className="mt-2 text-sm text-muted-ink leading-relaxed">{t.hint}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why Switch from Legacy Portals ─── */}
      <section className="py-16 md:py-24 border-b border-hairline">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="eyebrow">The platform</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl font-bold text-ink">
              What you get on Black Heritage
            </h2>
            <p className="mt-3 text-sm text-muted-ink">
              Made for how Nigerian events actually run: a packed door, patchy network, and vendors who need paying on schedule.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-surface border border-hairline relative">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold mb-4">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">Tickets land on WhatsApp</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                Most Nigerian attendees do not read email for tickets. The QR code goes to their WhatsApp right after checkout, so you hear fewer "I never got my ticket" at the door.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface border border-hairline relative">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">The gate works when the network doesn&apos;t</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                Signal dies at beach clubs and packed halls. The gate page saves tickets in the browser, so your staff keep scanning offline and it flags a ticket that has already been used. Gate staff accounts are free.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface border border-hairline relative">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold mb-4">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">Payouts in 24 hours, not 14 days</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                Ticket money goes to the bank account you add in settings within 24 hours. You can pay the sound engineer and the vendors when you said you would.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface border border-hairline relative">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold mb-4">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">A hub page for your brand</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                blackhevents.com/o/yourbrand holds your shows, video backdrop, and playlist. No banner ads for other people&apos;s parties on your page.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface border border-hairline relative">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">You keep the attendee list</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                Export phone numbers and emails whenever you want. Before the next show, message the crowd that came to the last one.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-surface border border-hairline relative">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center text-gold mb-4">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-ink">One flat fee: 6%</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-ink leading-relaxed">
                We take 6% of each ticket sold. No setup fee, no monthly charge, and no deduction you find out about after the show.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Interactive Ticket Revenue & Savings Calculator ─── */}
      <section className="py-16 md:py-24 bg-surface/20 border-b border-hairline">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="text-center max-w-xl mx-auto mb-10">
            <p className="eyebrow">Fees</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink">
              See what you keep
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-ink">
              Move the sliders. The comparison assumes a 10% fee at a traditional ticketing portal.
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-hairline shadow-2xl">
            <div className="space-y-6">
              {/* Attendees Slider */}
              <div>
                <div className="flex justify-between items-center text-sm font-medium mb-2">
                  <span className="text-ink">Expected attendees</span>
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
                  <span className="text-ink">Average ticket price</span>
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
                <p className="text-xs text-muted-ink">Ticket sales</p>
                <p className="text-xl sm:text-2xl font-bold font-display text-ink mt-1 tabular-nums">
                  ₦{grossRevenue.toLocaleString()}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-2/60 border border-hairline/60">
                <p className="text-xs text-muted-ink">Traditional portal fee (10%)</p>
                <p className="text-xl sm:text-2xl font-bold font-display text-destructive mt-1 tabular-nums">
                  ₦{legacyFee.toLocaleString()}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-gold/10 border border-gold/30">
                <p className="text-xs text-gold font-semibold uppercase tracking-wider">You save with Black Heritage</p>
                <p className="text-xl sm:text-2xl font-bold font-display text-gold mt-1 tabular-nums">
                  ₦{totalSavings.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link href="/auth?mode=register&role=organizer">
                <Button className="press h-12 px-8 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-sm rounded-full">
                  Create an organizer account
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
                  Free download
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink leading-tight">
                  The gate-fraud playbook for Nigerian promoters
                </h2>
                <p className="mt-3 text-xs sm:text-sm text-ink/80 leading-relaxed">
                  How promoters in Lagos and Abuja run the door: stop pass-backs, catch duplicate tickets, and get the crowd in before midnight.
                </p>

                <div className="mt-5 space-y-2.5">
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-ink/90">
                    <CheckCircle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                    <span>The 12-point gate checklist your bouncers can run</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-ink/90">
                    <CheckCircle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                    <span>A sponsor pitch outline for alcohol brands and banks</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-ink/90">
                    <CheckCircle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                    <span>A code for 0% platform fee on your first 100 tickets</span>
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
                    <h3 className="font-display text-lg font-bold text-ink">Check your email</h3>
                    <p className="text-xs text-ink/80 mt-1">
                      The playbook PDF is on its way to your inbox. Your code <span className="font-mono text-gold font-bold">FOUNDER100</span> waives the platform fee on your first 100 tickets.
                    </p>
                    <p className="text-xs mt-2">
                      <a
                        href="/api/playbook.pdf"
                        target="_blank"
                        rel="noreferrer"
                        className="text-gold hover:underline"
                      >
                        Open the playbook now
                      </a>
                    </p>
                    <div className="mt-4 pt-4 border-t border-hairline">
                      <Link href="/auth?mode=register&role=organizer">
                        <Button className="press w-full h-11 bg-primary text-primary-foreground font-semibold text-xs rounded-full">
                          Create your organizer account
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitLead} className="space-y-3.5">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-ink uppercase tracking-wider block mb-1">
                        Your name
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
                        Brand or collective
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
                        WhatsApp number
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
                        Email
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
                          City
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
                          Expected crowd
                        </label>
                        <select
                          value={formData.estimatedAttendance}
                          onChange={(e) => setFormData({ ...formData, estimatedAttendance: e.target.value })}
                          className="w-full h-10 px-2 rounded-lg bg-surface border border-hairline text-ink text-xs focus:outline-none focus:border-gold"
                        >
                          <option value="Under 50">Under 50</option>
                          <option value="50-100">50 to 100</option>
                          <option value="100-500">100 to 500</option>
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
                      {isSubmitting ? "Sending..." : "Send me the playbook"}
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
            <p className="eyebrow">Questions</p>
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
            Ready to sell tickets for your next event?
          </h2>
          <p className="mt-3 text-sm text-muted-ink max-w-xl mx-auto">
            Add your tiers and your page link, then put the event on sale. It takes a few minutes.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth?mode=register&role=organizer">
              <Button className="press h-13 px-8 bg-primary text-primary-foreground hover:bg-gold-soft font-semibold text-sm rounded-full w-full sm:w-auto">
                Create an organizer account
                <ArrowUpRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <a
              href={whatsappLink(CHAT_GREETING)}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="outline"
                className="press h-13 px-7 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-medium text-sm rounded-full w-full sm:w-auto"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat with the team
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
