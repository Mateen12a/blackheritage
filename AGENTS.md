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
