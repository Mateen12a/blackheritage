# White-label booking pages: architecture plan

The staged plan for giving organizers branded share links, from cheapest to
most involved. Stages 1 and 3 are built; the rest is mapped.

## Built: slug share links (stage 1)

Every event gets a slug (organizer-set or derived from the title, unique,
Collision-safe with suffixes). Share links are `/e/:slug`
(`blackheritage.africa/e/easter-sunday-cultural-gala` in production):

- `GET /api/events/by-slug/:slug` resolves the slug to the event
- Visiting the raw `/api/events/:id` URL in a browser 301s to `/e/:slug`,
  so the pretty form becomes canonical and search engines consolidate rank
- The event page's Share button copies the `/e/:slug` link, not the raw id
- The event form shows the slug; the organizer can edit it (lowercase,
  numbers, dashes; validated)

## Built: theme presets (stage 3, early)

Three curated palettes in `shared/themes.ts`, applied per event as scoped
CSS variables (nothing global mutates, dark marketplace pages are
unaffected):

- **Midnight Gold** - the platform look: indigo-black base, warm gold
  accent, hairline borders (Ethereal Deep Tone archetype)
- **Ivory Editorial** - warm ivory paper, espresso ink, deepened antique
  gold for contrast; for daytime, cultural, and corporate events
  (Editorial Luxury archetype)
- **Sunset Poster** - ember orange on deep plum; loud nights, festivals,
  parties (bold poster archetype)

The organizer picks in the event form via miniature live previews (each
card renders its own palette). Their logo and accent color layer on top of
any preset. Text/background pairs in each preset were chosen for WCAG AA
contrast (ivory's gold darkens to #9A6B1F to hold 4.5:1 on paper).

## Built already (foundation)

Per-event branding: display name, logo URL, and accent color on the event
page ("Presented by"), the PDF ticket header, and the confirmation email.
Every branded surface keeps the "Powered by / issued via BlackHeritage"
credit. CORS in `server/index.ts` already trusts subdomain/custom-domain
origins via `TRUSTED_ORIGIN_SUFFIXES` for stage 4.

## Stage 2: subdomains (1 to 2 weeks, wildcard cert) — not built

`tunde.blackheritage.africa` serves that organizer's public event list with
their branding applied.

How it works:

1. **DNS**: one wildcard A record `*.blackheritage.africa` -> the VM IP.
2. **TLS**: one wildcard certificate covering `*.blackheritage.africa`
   (Let Encrypt issues these via the DNS-01 challenge; renew on a timer).
3. **Routing**: Nginx `server_name *.blackheritage.africa` proxies to the
   same Node app. The app reads the `Host` header, looks up the organizer
   (a `slug` or `subdomain` column on the organizer user or a new org
   profile), and serves their page. No per-tenant processes.
4. **Subdomain claim**: organizer sets it in settings; reserved words
   (`www`, `api`, `admin`, platform names) are blocked; uniqueness enforced.
5. **Cookies**: session cookie must be set on the parent domain
   (`.blackheritage.africa`) so login works across subdomains.

## Stage 4: custom domains (only when paying customers ask) — not built

`tickets.tundelive.com` pointing at us. Real cost: per-domain SSL via
Caddy (automatic) or certbot, DNS verification UX, support for broken
CNAMEs. Paywalled feature only. Caddy makes this dramatically simpler than
hand-rolled certbot: it provisions and renews certs on demand.

## What stays centralized (deliberate)

The marketplace at the root domain remains the discovery hub. Subdomains are
share links, not homes: every organizer page keeps browse/events navigation
back to the platform so buyer traffic cross-shops other events. Full
white-label that hides the platform kills the marketplace loop.

## Rollout order and why

Stage 1 and 2 unlock the distribution loop organizers actually want (their
brand in their WhatsApp broadcast). Stage 3 is the visible polish. Stage 4
is where the support burden starts; do not build it speculatively.

Monetization: free organizers get standard links; a premium tier unlocks
subdomains, then custom domains. It stacks on the commission model instead
of competing with it.
