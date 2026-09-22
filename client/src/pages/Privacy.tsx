import { Link } from "wouter";
import { PublicLayout } from "@/components/PublicLayout";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "What we collect",
    body: [
      "Account details: your name, email address, username, password (stored as a hash, never in plain text), and if you choose to add them, a photo, bio, and social links.",
      "Ticket purchases: the name and email you give at checkout, what you bought, how much you paid, and your payment reference. We never see or store your card number; our licensed payment processor handles the card.",
      "Messages: if you message a vendor or organizer through the platform, we store the conversation so both sides can read it later.",
      "Gate check-ins: when a ticket is scanned, we record that it was used and when.",
      "Technical basics: server logs with your IP address and browser type, kept for security and troubleshooting.",
    ],
  },
  {
    title: "What we do with it",
    body: [
      "Deliver the service: issue tickets, send confirmation emails, run gate verification, show your profile, and process refunds.",
      "Let organizers run their events: an organizer sees the attendee list for their own events (name, ticket type, ticket reference, check-in status). They do not see your other events or your card details.",
      "Send email you asked for: ticket confirmations always. If you follow an organizer, they can email you when they publish a new event. Every one of those emails has a one-click unsubscribe.",
      "Improve the platform: we look at totals and patterns (which pages get used, where people drop off). We do not sell your personal data, and we do not give it to advertisers.",
    ],
  },
  {
    title: "Who else sees your data",
    body: [
      "Our payment processor (to take payments and pay refunds), our email provider (to send you email), and our hosting provider (to run the site). Each only gets what it needs to do its job.",
      "The event organizer for events you attend, as described above.",
      "Anyone you choose to share with: if you message a vendor, they see your messages and display name.",
      "We will disclose data to law enforcement only on a valid Nigerian legal order.",
    ],
  },
  {
    title: "How long we keep it",
    body: [
      "Account data: until you delete your account.",
      "Ticket and payment records: six years, because Nigerian tax and accounting rules require it.",
      "Server logs: 90 days.",
      "Messages: until both sides' accounts are gone or the conversation is deleted.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "You can see and correct your details any time on the settings page.",
      "You can download your data or ask us to delete your account by writing to hello@blackheritage.africa. We will action it within 30 days, keeping only what the law makes us keep.",
      "You can unsubscribe from follower emails with the link in any of them.",
      "You can complain to the Nigeria Data Protection Commission if you think we mishandled your data. We would rather you came to us first so we can fix it.",
    ],
  },
  {
    title: "Cookies",
    body: [
      "We use one essential cookie to keep you signed in, and local storage to remember small interface choices. No advertising cookies, no third-party trackers.",
    ],
  },
];

export default function Privacy() {
  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-3xl px-4 py-14 md:px-8 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          Legal
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">
          Privacy policy
        </h1>
        <p className="mt-3 text-sm text-muted-ink">
          Last updated: 22 September 2026. We follow the Nigeria Data
          Protection Act 2023. Write to hello@blackheritage.africa with any
          question and a person will answer.
        </p>

        <div className="mt-10 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-lg font-bold text-ink md:text-xl">
                {s.title}
              </h2>
              <div className="mt-3 space-y-3">
                {s.body.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-muted-ink">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-14 text-sm text-muted-ink">
          Also read the{" "}
          <Link href="/terms" className="text-gold underline-offset-4 hover:underline">
            terms of service
          </Link>
          . They govern your use of the platform.
        </p>
      </div>
    </PublicLayout>
  );
}
