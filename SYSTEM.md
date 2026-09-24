# Black Heritage Events: system reference

Everything about the platform in one file. Written from the actual code, not intentions. Last updated: September 2026.

## What this is

Black Heritage Events is a Nigerian events marketplace and ticketing system: guests discover events and buy tickets with instant e-ticket delivery, organizers run the full event lifecycle (tiers, promos, gate scanning, refunds, payouts), and vendors sell their services into the same audience. The positioning from GROWTH-PLAN.md holds: the competitor is not another ticketing site, it is WhatsApp coordination, DMs to vendors, and transfers with screenshots. Production domains referenced in the code are blackheritage.africa (app) and blackhevents.com (SEO surface).

## Where the system stands

- Core marketplace, booking, payments, gate verification, vendor profiles, organizer tools, white-label links, themes, AI flyer extraction, and email: built and verified.
- Test suite: 119 e2e assertions passing (`scripts/e2e.cjs`), covering the full ticketing lifecycle through real Paystack webhooks, slug 301 promotion, registration variants, terms consent, the E11000 sparse-index regression, and AI extraction end to end with the real Gemini key.
- Typecheck (`npx tsc --noEmit`) clean. Design system locked in DESIGN.md; agent guidance in AGENTS.md.
- What remains for a hard launch: configure Google OAuth keys (module exists, credentials absent), set SESSION_SECRET and PUBLIC_APP_URL for production, run a real designed flyer through the extraction panel, and provision the server per DEPLOY-ORACLE.md.

## Stack and architecture

- Frontend: React 18, Vite, Tailwind v4, wouter (routing), TanStack Query (server state), shadcn/ui primitives, Framer Motion helpers in `client/src/components/motion.tsx`. Pages under `client/src/pages`, hooks under `client/src/hooks/use-*.ts`.
- Backend: Express + Mongoose on MongoDB. 17 server modules: `index` (bootstrap), `routes` (65 endpoints), `auth` (passport local + express-session + rate limiting + Google OAuth), `booking` (quote/initiate/finalize engine), `paystack` (API + HMAC-SHA512 webhook verification), `tickets` (PDF generation), `emails` (Resend), `ai` (Gemini boundary), `storage` (data access), `models` (16 schemas), `seed` (self-healing demo state), `static`, `vite`, `env`, `google-auth`, `fix-db`, `db`.
- Shared contracts: `shared/routes.ts` (typed API map), `shared/schema.ts` (zod + mirrored types), `shared/themes.ts` (event theme presets), `shared/models/auth.ts`.
- Build: `vite build` then esbuild bundles the server to `dist/index.cjs`. Run: `NODE_ENV=production node dist/index.cjs`. Dev: `npm run dev` (Vite on 5000, API on 3001).
- The Mongoose layer is the real data store; the drizzle tables in `shared/schema.ts` mirror it for types and validation only.

## Roles and account types

Six working identities on top of three stored roles:

- **Guest** (`role: user`): browse, buy, autofilled checkout, my-tickets by session, follow organizers, message vendors, rate vendors, join waitlists.
- **Organizer** (`role: organizer`): create and manage events, tiers, table bookings, promo codes, media, branding, themes, booking links, waitlists, attendee and scan CSVs, live stats, payouts view, manual tickets, team staff, followers, announcements, custom domains. Organizer signup asks for a brand name; welcome email is organizer-specific.
- **Admin** (`role: admin`): everything, plus platform settings, native sponsor management, organizer leads, payout settling. Separate login surface at `/admin/login`.
- **Team staff** (any role + `teamOwnerId` + `staffRole`): manager, finance, or entry. Staff operate inside the owner's scope. Entry staff open the gate verification portal.
- **Vendor** (organizer-role account owning a `Vendor` profile): published or draft business listings in seven categories (DJ, MC, Caterer, Decorator, Photographer, Live Band, Other with custom label), gallery, videos, socials, ratings, per-event vendor packages, vendor booking links. A vendor tab appears in the dashboard only when a profile exists; guests never see a My Shop entry.
- **Gate staff demo account**: `gate_staff` seeded with `staffRole: "entry"` for verification-portal demos.

Terms gate: signup requires `acceptedTerms`, recorded as `termsAcceptedAt` (consent audit trail). Google OAuth accounts bypass this today; the callback needs a consent step before launch.

## Feature inventory

### Discovery and marketplace
- Home with hero, native sponsor spotlight, events feed; Explore with placement slots; Events directory; Calendar; Organizer profiles (`/o/:slug`) and directory with follow/unfollow and email unsubscribe; Vendor directory (`/vendors`) with category filters and vendor detail pages (`/v/:slug`) with ratings, gallery, trust conversation, sponsor/vendor application on events.

### Ticketing and payments
- Quote, initiate, Paystack charge, signed `charge.success` webhook, finalize. A bare finalize call is rejected with 402 by design. Real keys are in `.env`, so simulated payment mode is off.
- Ticket tiers with capacity, per-tier pricing in kobo, table bookings with guest-supplied table details (only when the tier is a table), promo codes with applied-chip UI, per-event customizable toggles (for example show tickets-remaining on or off, sponsors and vendors on or off), waitlist with CSV export, manual tickets, refunds, per-event sponsor and vendor packages paid through the same rails.
- E-ticket PDF per booking with branded header, confirmation email via Resend, ticket reveal UI, guest ticket lookup by email or reference, logged-in lookup by session, gate verification by code.

### Gate verification
- `/verify` portal: live code checks, staff authorization (admin, entry/manager staff, organizer), scan event logging, override flow, sync endpoint, CSV exports of valid tickets and scans, live stats and pulse endpoints per event.

### Vendor and sponsor economy
- Vendor profiles with slug, slug aliases, theme, branding, portfolio uploads (multer, 50MB), ratings, trust messaging, per-event vendor applications and packages.
- Native sponsors with placement slots (home spotlight, explore feed, events sidebar) plus impression and click tracking.

### White-label (booking links)
- Built: unique slugs per event and vendor (`/e/:slug`, `/v/:slug`), 301 promotion from raw id URLs to pretty slugs on real browser navigation only, share buttons copy the pretty link.
- Built: three theme presets (Midnight Gold, Ivory Editorial, Sunset Poster) applied as scoped CSS variables per event or vendor, with organizer logo and accent color layered on top; WCAG AA text pairs per preset.
- Built: custom booking link settings with event logo replacing the platform brand on branded pages, plus `Powered by BlackHeritage` credit everywhere.
- Mapped but not built (WHITE-LABEL.md): subdomains (`tunde.blackheritage.africa`, stage 2) and full custom domains with DNS verification (stage 4; the user model and CORS trusted-suffix plumbing exist).

### AI (Gemini)
- `server/ai.ts` owns the Gemini boundary. `POST /api/ai/extract-event`: organizer uploads a flyer image, PDF, or text document up to 15MB; Gemini vision returns strict JSON (title, description, date, venue, tiers with naira prices, organizer name, notes) which prefills the New Event form for human review. Nothing is created or published by the model. Guards: 403 for guests, 503 without key, 10 extractions per 10 minutes per organizer, mime allowlist. Planned next: Flyer Studio generation onto the existing 577-line canvas renderer with public/private toggle.

### Messaging, follows, growth
- Conversation messaging between guests, vendors, organizers; unread counts.
- Organizer follows with follower counts and an unsubscribe flow on broadcast emails.
- Organizer lead capture (the Lagos Event Checklist magnet) with claimed-offer tracking; role-specific welcome emails; GROWTH-PLAN.md holds the full zero-budget launch plan (positioning, copy structure, lead magnet, sequences).

## Data model: 16 collections

User (roles, staff, branding, socials, announcement, termsAcceptedAt, customDomain), Event (tiers, settings, branding, slug, theme, waitlist, media), Booking, Vendor, BusinessBooking (per-event sponsor or vendor packages), Message, Ticket, ScanEvent, PromoCode, PlatformSetting, Payout (with settle), Waitlist, OrganizerFollower, VendorRating, NativeSponsor, OrganizerLead.

Two known index traps, both fixed and documented in the schemas: sparse-unique fields must not carry `default: null` (the E11000 collision class), and each rate limiter instance must own its counter map (the shared-map 429 bug).

## API surface and routes

65 API endpoints under `/api`: events (CRUD, branding, settings, promos, waitlist, manual tickets, media, live stats, pulse, CSVs, by-slug, verify-context), bookings (quote, initiate, finalize, search, tickets, PDF, refund, verify), vendors (CRUD, by-slug, link, look, ratings, trust), organizers (profile, follow, followers), messages, team, uploads, payouts, platform settings, sponsors, leads, AI extraction, sitemap, Paystack webhook, verify portal endpoints.

31 client routes: public (home, events, event details, calendar, organizers, vendors, vendor detail, organizer detail, terms, privacy), auth, dashboards (dashboard, vendor-dashboard, admin suite with events, bookings, sponsors, vendors, leads), management (new event, manage event, messages, settings), tickets, verify, and the slug surfaces (`/e/:slug`, `/v/:slug`, `/o/:slug`).

## Environment and keys

Loaded via `server/env.ts` (`loadEnvFiles`). Present in `.env`:

- `MONGODB_URI`: database connection.
- `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`: live-mode payments and webhook HMAC.
- `RESEND_API_KEY`: transactional email.
- `GEMINI_API_KEY`: AI extraction.

Still to provide or set for production:

- `SESSION_SECRET`: required in production or the server refuses to start (cookies would be forgeable otherwise).
- `PUBLIC_APP_URL`: canonical URL used in emails and share links; defaults to localhost:5000 in dev.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google sign-in. The module exists and fails gracefully today, but a consent step must be added to the OAuth callback before enabling it, since OAuth signups bypass the terms checkbox.
- Email sending domain in Resend (from-address verification).

## What the system can honestly handle

Fine today for hundreds to low thousands of concurrent users on one machine: stateless Express behind one Node process, indexed Mongo queries, streaming PDFs, disk uploads. The architecture is deliberately boring in the good way: one server module per concern, one data-access layer, shared contracts.

What breaks before "millions" and the fix for each:

- In-memory sessions (express-session default store): restart logs everyone out; horizontal scaling needs a shared store (Mongo or Redis session store; Mongo store is a small change with the existing stack).
- In-memory rate limiting: per-process only; needs Redis behind more than one node.
- Uploads land on local disk via multer: needs object storage (S3-compatible or Oracle Object Storage) plus a CDN before real traffic.
- No background job queue: emails send inline in the request; fine at current volume, needs a worker for campaign-scale sends.
- One Node process: needs PM2 or cluster mode and Nginx in front (both already specified in DEPLOY-ORACLE.md) before scaling out.
- No monitoring or error tracking wired: add uptime checks and an error reporter at deploy time.

Deployment target is Oracle Cloud Always Free (one Arm VM: Nginx, Node, MongoDB), fully documented step by step in DEPLOY-ORACLE.md including DNS, SSL, PM2, and firewall rules. Zero monthly cost until scale demands more.

## Testing and operations

- `node scripts/e2e.cjs` runs the 119-assertion suite against a live backend on 3001. The suite intentionally mutates demo state; restarting the backend re-runs `server/seed.ts`, which self-heals the flagship event, tiers, vendor showcase, trust conversation, gate staff, and tier headroom. Do not hand-repair rows after a test run; restart instead.
- The pretty-link 301 only fires for real address-bar navigation (`Sec-Fetch-Mode: navigate` or absent); test clients get JSON from the same URL and must use raw http to simulate a browser.
- Backend restarts pin `PORT=3001` via `.freebuff/restart-backend.ps1`; inline PowerShell one-liners have twice dropped the port and silently bound to 0.
- Typecheck: `npx tsc --noEmit`. Frontend production build: `vite build`.

## Document map

- `AGENTS.md`: working rules for agents and humans (design lock, stack notes, server behaviors that are not obvious, mobile regression traps).
- `DESIGN.md`: locked token system (indigo-black base, single gold accent #E3B23C, Playfair Display / DM Sans), motion rules, banned patterns, voice and copy rules.
- `WHITE-LABEL.md`: white-label stages, built versus mapped.
- `GROWTH-PLAN.md`: zero-budget launch plan, positioning, lead magnet, email sequences.
- `DEPLOY-ORACLE.md`: full Oracle Always Free deployment instructions.
- `SYSTEM.md`: this file.
