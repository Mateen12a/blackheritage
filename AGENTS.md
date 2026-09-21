# AGENTS.md

Guidance for AI agents (and humans) working in this repository.

## Design direction is locked — read DESIGN.md first

Before writing or changing any UI in `client/`, read **[DESIGN.md](./DESIGN.md)**
at the repo root. It defines the token system (indigo-black base, single gold
accent `#E3B23C`), the Playfair Display / DM Sans type rules, the motion
system (two signature moments — the sliding gold nav underline and the Home
hero reveal — plus the quiet `Reveal`/`FadeImg`/`press` helpers), and an
explicit list of patterns that must NOT be reintroduced (cream backgrounds,
purple gradients, gold gradient text, bounce hovers, identical soft-shadow
cards, scattered entrance animations, decorative ALL-CAPS).

Tokens are implemented in `client/src/index.css`. If you genuinely need a new
token or exception, update DESIGN.md in the same change — deliberately, not
by drift. DESIGN.md also locks the **voice & copy** rules (Lagos-first
marketplace framing, counted headers, outcome CTAs, recovery empty states) —
same contract: change the docs deliberately, not by drift.

## Stack notes

- Client: React 18 + Vite + Tailwind v4 + wouter + TanStack Query + shadcn/ui
  primitives, under `client/src`. Wouter's `Link` renders an `<a>` you can
  style via `className`/`ref` directly.
- Backend: Express + Mongoose (`server/`), shared zod schema and API map in
  `shared/`.
- The real data store is the Mongoose layer (`server/models` +
  `server/storage.ts`); the drizzle tables in `shared/schema.ts` mirror it for
  shared types and validation.

## Conventions

- Reuse the existing hooks (`client/src/hooks/use-*.ts`) and page patterns;
  don't invent parallel CRUD paths.
- Typecheck with `npx tsc --noEmit`; production frontend build is `vite build`.

## Server behavior that is not obvious from the code

- The pretty-link 301 promotion (`/api/events/:id` -> `/e/:slug`) fires only
  on real address-bar navigation: the test is `Sec-Fetch-Mode: navigate` or
  the header's absence. Node's undici fetch ALWAYS sends
  `sec-fetch-mode: cors`, so test clients get JSON and must use raw `http`
  when simulating a browser visit. Chromium also caches 301s hard; use
  cache-busted fetches when probing.
- Restarting the backend re-runs `server/seed.ts`, which self-heals the demo
  state (flagship settings, tiers, vendor showcase, trust conversation, tier
  headroom). The e2e suite intentionally mutates that state; restore by
  restarting the backend rather than hand-fixing rows.
- `.env` holds real Paystack keys, so dev "simulated" payment mode is OFF.
  The booking test path is: initiate -> signed `charge.success` webhook
  (HMAC-SHA512 with `PAYSTACK_SECRET_KEY`) -> finalize. A bare finalize gets
  a 402 by design.
- This shell's bash eats `$` inside double quotes; write PowerShell logic
  into `.freebuff/*.ps1` scripts instead of inline `-Command` one-liners.

## Mobile layout rules (regression-prone)

- Radix `TabsList` is `inline-flex` and will NOT wrap or shrink: on mobile it
  widens the page. Any TabsList with 4+ tabs needs
  `max-w-full overflow-x-auto no-scrollbar` (utility lives in index.css).
- Tables must sit inside an `overflow-x-auto` wrapper or they widen the page.
- The overflow probe that finds real offenders: compare
  `document.documentElement.scrollWidth` vs `clientWidth`, then walk elements
  wider than the viewport. Visual bugs at narrow width are usually one
  non-shrinking flex row, not the container.

## React hooks discipline in this codebase

- EventDetails/VendorDetails resolve their id from TWO route shapes (raw id
  and slug). Data hooks (`useEventPulse`, `useCountdown`, `useVendorTrust`)
  must be called ABOVE the loading/not-found early returns or React crashes
  with hook-order errors on the first render; pass `undefined` id and let
  `enabled` gate the fetch.

## Test-file gotchas

- `scripts/e2e.cjs` is plain JavaScript (node, not tsx): no TS annotations
  inside it.
- The suite's cumulative bookings sell flagship tiers down; the seed's
  headroom heal (min 10 remaining per tier) is what keeps re-runs green.
- `var x = ...` initializers run at function scope: an `await` before the
  initializer silently wipes the captured value (this bit the 301 test).
