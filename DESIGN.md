# DESIGN.md — Black Heritage Events & Entertainment

This is the locked visual direction for the product. Every new page, component,
or prompt should inherit from this file. If a change conflicts with it, the
change is wrong — update this file first, deliberately, before deviating.

**Direction in one line:** editorial nightlife — a deep indigo-black base,
one warm gold accent used sparingly, photography treated as the hero of every
card. The palette is taken from the brand mark itself (`client/src/assets/logo.png`,
an antique-gold emblem; `logo2.png`, its black-field variant), so UI and logo
read as one brand.

## Token system

| Token | Hex | Role |
|---|---|---|
| `background` | `#0F0F14` | Page base — deep indigo-black. Never cream, never white. |
| `surface` | `#19191F` | Raised panels: cards, sidebar, mobile menu. |
| `surface-2` | `#1F1F26` | Recessed wells: inputs, empty image slots. |
| `ink` | `#F7F5EF` | Primary text. Warm off-white, not pure white. |
| `muted-ink` | `#9EA0AD` | Secondary text, placeholders, inactive states. |
| `gold` | `#E3B23C` | THE accent — active nav, gold rules, key CTAs. Sparingly. |
| `gold-soft` | `#F2CE72` | Gold hover state only. |
| `hairline` | `#31313A` | All borders. Hairlines instead of shadows. |

Tokens live in `client/src/index.css` (`@theme` + `:root` HSL aliases for the
shadcn primitives). Tailwind exposes them as `bg-background`, `text-ink`,
`text-muted-ink`, `text-gold`, `border-hairline`, `bg-surface`,
`bg-surface-2`, `bg-gold-soft`.

Where gold appears (the closed set): active nav link + the sliding nav
underline, the 2px left-anchored rule under page titles (`rule-gold`), primary
buttons, small gold icons in metadata rows, gold dot/dash accents in the
mobile menu. Nothing else. If you're adding gold somewhere new, take something
else away first.

## Typography

- **Playfair Display** — display only: page titles, card titles, prices.
  Loaded weights: 400/600/700/800 + one italic. Use `font-display`.
- **DM Sans** — everything else: body, UI, buttons, inputs, labels.
  Loaded weights: 400/500/700. This is the default body font.
- The pairing is deliberate and inherited from the original build. Do NOT
  swap it, and do NOT introduce a third font.
- `eyebrow` (in index.css) is the single sanctioned small-label style:
  DM Sans 11px, bold, `tracking-[0.18em]`, uppercase, muted. Use it for
  metadata only — dates, categories, section labels. Not for headings,
  not for buttons, not scattered on every element.

## Layout grammar

- **Photo-forward cards:** event flyers and vendor portfolio shots are the
  hero — full-bleed portrait (`aspect-[3/4]`), a soft bottom gradient into the
  background for text legibility, title below, one hairline-separated footer
  row. The photo is the identity of the card; icon-only fallbacks use a
  recessed `surface-2` field.
- **Hairlines, not shadows:** panels are `border border-hairline` with
  `rounded-md` (6px). No `shadow-xl` ornament, no `rounded-3xl` bubbles.
- **Editorial page headers:** eyebrow → Playfair title → 16px gold rule →
  one-sentence description, left-anchored (not centered), max-w-3xl.

## Motion — two signature moments, then quiet

The product has exactly **two** deliberate motion moments:

1. **The sliding gold nav underline.** A single gold underline slides between
   links in the navbar. Lives in `Navbar.tsx` (`underlineStyle` + the
   `transition-[transform,width,opacity]` span).
2. **The Home hero.** A one-time staggered rise of kicker → headline →
   subline → CTAs over an ambient gold bloom, then a persistent slow life:
   rising embers around the next-event poster (`animate-ember`) and a
   pausable ticker of real on-sale events (`animate-ticker`), both defined
   in index.css. First paint for the entrance; the embers and ticker run
   continuously but collapse under reduced motion.

Everything else uses the **quiet helpers** in `client/src/components/motion.tsx`
and stays within these tiers:

- `Reveal` — scroll-in sections: fade + 14px rise, once, never re-animates.
  Used for page headers, section intros, CTA panels. NOT wrapped around every
  card or list item.
- `FadeImg` — images fade in on viewport entry. No slide, no scale.
- `press` (CSS utility) — buttons compress `scale(0.98)` while active.
- Card hover = photo scale `group-hover:scale-[1.03]` (tagged
  `data-motion="scale-on-hover"`) + title turning gold. No lift, no shadow.
- No `whileHover={{ y: ... }}`, no springs, no bounce/elastic easing, no
  entrance animations outside the helpers above, no per-card stagger chains.
- All motion runs through framer-motion's `MotionConfig reducedMotion="user"`
  (`MotionProvider` in App.tsx) plus the global `prefers-reduced-motion`
  block in index.css — motion collapses to instant states for users who ask
  for it, including the ken-burns and photo zoom.
- Keyboard focus is always visible: global `:focus-visible` gold outline with
  offset (index.css). Do not remove it or override with `outline-none`.

## Voice & copy (locked)

The product is a **Lagos-first marketplace for events and entertainment** —
not a generic ticketing utility. Copy carries that positioning:

- **Voice:** warm, confident, Lagos-specific. Concrete nouns (owambe, Lekki,
  afrobeats, WhatsApp) over abstractions. A host, not a corporation.
- **Marketplace framing:** two-sided. Organizers run events; vendors get
  "a standing profile, not a one-off sponsor slot". Never describe the
  product as "a ticketing site".
- **Trust as copy:** Paystack checkout, instant e-tickets, "free to list" —
  say the specific mechanism, not "secure and reliable".
- **Headers are counted, not vague:** "{N} shows on sale", "{N} vendors
  across Lagos" — compute from data when the page has it.
- **CTAs are outcomes:** "Find Events Tonight", "Hire a Vendor", "Message on
  WhatsApp" — not "Submit"/"Buy Now".
- **Empty states are recovery paths:** name the fix ("Try “afrobeats” or
  “Lekki”") and cross-sell the other side of the marketplace.
- **Never:** "Sign in to manage your events" placeholder-speak, generic
  "Find amazing events" (that was Eventbrite's 2019 line), lorem ipsum,
  exclamation-mark hype, or invented statistics.

## What NOT to reintroduce

This list exists because each of these was present and removed in the
September 2026 design pass. Do not bring them back:

1. **Cream or warm light backgrounds** (`amber-50`, `#faf3e0`, etc.) — the
   base is indigo-black, full stop.
2. **Purple / indigo / violet / fuchsia gradients** — there are none; keep it
   that way.
3. **Gold gradient text** (`gold-text-gradient`, `bg-clip-text` with gradient)
   — retired. Accent words in titles are solid gold or nothing. The old class
   names still exist in index.css only as solid-gold aliases for stragglers.
4. **Bounce / elastic / spring hover easing and card lift** (`whileHover={{
   y: -5 }}`, spring configs) — hover is color + 1.03 photo scale, nothing else.
5. **Identical rounded cards with the same soft shadow on everything**
   (`rounded-2xl`/`rounded-3xl` + `shadow-lg`/`shadow-xl` on every surface) —
   use hairlines + `rounded-md`.
6. **Decorative ALL-CAPS labels everywhere** — caps belong to the `eyebrow`
   style on metadata only.
7. **Fade-and-slide-up entrances scattered across every section** (per-card
   `initial={{ opacity: 0, y: N }}` with `delay: index * 0.1` staggers, raw
   `motion.div` outside the sanctioned helpers) — motion belongs to the two
   signature moments and the quiet `Reveal`/`FadeImg` helpers, nothing else.
   Embers exist only in the Home hero; do not sprinkle them on other pages.
8. **Numbered 01/02/03 markers with no real sequence**, and any other
   decorative filler.
9. **Loading extra font families** in index.html — Playfair Display and
   DM Sans are the entire set.
