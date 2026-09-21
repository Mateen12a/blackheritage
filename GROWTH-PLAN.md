# Growth and launch plan for Black Heritage Events

This plan assumes zero marketing budget at the start. It runs on the product you already have: real events, real vendors, instant tickets.

## Positioning (one sentence)

Black Heritage Events is where Nigeria books its parties: tickets confirmed in under a minute, a code that scans at the gate, and vetted vendors one tap away.

Say it that plainly on the landing page, in ads, and in conversation. The competitor is not another ticketing site. The competitor is WhatsApp coordination, DMs to vendors, and transfers with screenshots. Every message should position against that friction, not against other platforms.

## Landing page copy fixes (copywriting pass)

Current homepage leads with "experience the vibes," which describes a feeling, not a reason to act. Restructure:

- **Headline**: "Book your next event in under a minute."
- **Subheadline**: "Concerts, festivals and owambe across Nigeria. Verified e-ticket on your phone, scanned at the gate. No printing, no stress."
- **Primary CTA**: "Find events" (weak: "explore", "learn more").
- **Second CTA for the supply side**: "Sell tickets for your event" pointing at organizer signup.
- Add a social proof strip as soon as real numbers exist: events run, tickets scanned, vendors listed. Do not launch with invented numbers.
- Add a "how it works" row of three steps: pick an event, pay by card/transfer/USSD, show your code at the gate.

## Lead magnet (lead-magnets pass)

Build one asset for the supply side, because organizers have the strongest pain and the clearest path into the product:

**"The Lagos Event Checklist: 42 things to lock before gates open."**

- Format: one-page checklist PDF, consumable in 10 minutes, professional enough to look paid for.
- It solves the exact moment of panic an organizer feels two weeks before their event, which is when they start looking for ticketing.
- Capture: email only. Deliver instantly. The thank-you page offers "create your first event" with the checklist email following up.
- The checklist naturally bridges into the platform: tiering tickets, promo codes, gate scanning are all checklist items the product does for them.
- Production: one afternoon with the real operational knowledge already in this codebase (sale windows, capacity holds, scan logs, refunds).

A second magnet for attendees can wait until there are 20+ events live; attendee acquisition responds better to ads and social proof than to lead magnets.

## Email sequence (emails pass)

Welcome sequence for organizer signups (fires today, thanks to the welcome email now wired at registration):

1. **Immediately**: Welcome + account live + one clear action: browse events or create your first. (Already built: `sendWelcomeEmail`.)
2. **Day 2**: The checklist PDF + the single most common first-week mistake (pricing tiers with no sale window).
3. **Day 4**: Proof: how one organizer ran GA/VIP/Table tiers, sold out, and scanned everyone in without a paper list. Use a real customer once one exists; until then, tell the product story without invented numbers.
4. **Day 7**: Objection killer: "What if nobody comes?" Free event setup, promo codes, and the share-to-WhatsApp flow.
5. **Day 10**: Direct invitation: "Your first event takes 15 minutes to publish. Here's the link."

Attendee lifecycle (lighter):

1. **Purchase confirmation**: exists, with PDF.
2. **3 days before event**: reminder with gate instructions and the ticket re-download link. Not built yet; add when volume justifies it.
3. **1 day after event**: "How was it?" one-tap rating, feeding future testimonials. Not built yet.

Keep subject lines under 45 characters, preview text 90-120, one CTA per email.

## Ad creative (ad-creative pass)

Start only after 10+ events are live, so the ads land on a page with real inventory. Two angles, tested as statics before any video spend:

**Angle A: The ticket anxiety killer (attendees)**
- Hook: "Your ticket, your phone, your gate."
- Meta primary text: "No more screenshots and 'have you seen my transfer?' Book, pay, show the code. Tickets for Lagos's best parties, confirmed instantly." (118 chars)
- Headline: "Book in under a minute" (22)
- CTA button: "Book now"

**Angle B: The organizer's paper-list nightmare (supply)**
- Hook: "Stop counting cash at the gate."
- Meta primary text: "Sell GA, VIP and table tickets. Track sales live. Scan every guest with a code that works once. Your first event is free to set up." (130 chars)
- Headline: "Sell tickets, scan guests, relax" (32)
- CTA button: "Sign up"

Character counts above fit Meta specs. Run each as 3 statics (event crowd photo, gate-scan phone mockup, dashboard screenshot) before spending on video. Never fabricate testimonials or stats in creative; the product claims above are all true today.

## SEO and GEO (seo-audit + seo-geo passes)

Done in this codebase now: robots.txt with AI crawler allowances, sitemap starter, canonical, Organization + WebSite JSON-LD, meta description rewritten around what buyers search.

Next steps in order:

1. **Google Search Console + Bing Webmaster**: submit the sitemap after deploy. This is the single highest-leverage free action.
2. **Event JSON-LD on event pages**: `Event` schema with name, date, venue, offers (price, availability). Event rich results are the biggest organic win available to a ticketing site; implement on EventDetails render.
3. **Static-render event pages**: the site is a client-rendered SPA, so crawlers see an empty shell until JS runs. Vite prerendering of event and vendor detail routes, or moving those two routes to SSR, is the biggest technical SEO unlock. Do it after launch when there are real pages worth indexing.
4. **Vendor directory pages become landing pages**: "DJ in Lagos", "Caterers in Lekki" map to real filtered views you already have. Title-tag them accordingly.
5. **GEO content**: one definitive page per city-category ("Where to find a wedding MC in Abuja") with quotable definitions, named vendors, and prices from the platform. AI engines cite pages with specifics; your database IS the specificity.
6. **Core Web Vitals**: images already load via Unsplash CDN; add width/height attributes to kill CLS, and lazy-load below-fold imagery.

## Bring users to the system: the demand plan

The uncomfortable truth: platforms die from empty rooms, not missing features. Sequence matters. Do these in order:

**Phase 0 (now, free): Seed supply first.**
- Sign up 5 organizers you actually know. Do their first event setup for them, by hand, on a call. Their live events make the site non-empty.
- Sign up 20 vendors (the seeded demo shows the pitch: profiles with videos, socials, in-app chat). Free listings at launch.
- One condition for free vendor setup: they share their profile link once on their WhatsApp status. Vendors' audiences are your attendees.

**Phase 1 (launch week): WhatsApp-first distribution.**
- Nigeria's events economy lives on WhatsApp. Every event page needs a share button that formats a rich WhatsApp message (event card image, price, "get tickets" link). Not built yet; small build, huge leverage.
- Every ticket email includes "bring a friend" forward copy.
- Organizer gets a promo code by default (e.g. TEAMNAME20) to seed their own group chats; you already track promo performance.

**Phase 2 (first 90 days): Community and proof.**
- Post-event galleries (organizers already upload them) double as content: tag attendees, attendees reshare.
- Collect one gate-scan video from every organizer; that footage is next season's ads (Angle B).
- Cross-promotion loop: every vendor profile links to events they're playing; every event page links to its vendors. The marketplace cross-links itself.

**Phase 3 (when numbers justify spend): Paid.**
- Only run the Meta ads above when the landing page converts organically (measure first). ₦50k test budget on Angle A against 25-40 Lagos, interests: afrobeats, nightlife,Eventbrite. Scale what gets cost-per-ticket-sale under your commission economics.

## Metrics that matter (in order)

1. Tickets scanned (not sold: scanned means the whole loop worked).
2. Events live (supply health).
3. Repeat buyer rate at 60 days.
4. Organizer 2nd-event rate.
5. Vendor enquiries sent through in-app chat (proves the marketplace).

Review weekly for the first month. The e2e suite already proves the machine works; these five prove the business does.
