# YouInc — "The Incorporation" redesign plan

Date: 2026-07-13
Status: approved for implementation
Scope: full marketing surface redesign (dark terminal cinema) + app/auth reskin to match

---

## 0. Context and goal

The current marketing site (`frontend/src/components/marketing/`) is a competent but
generic light soft-UI SaaS landing page: hero → proof strip → how-it-works → dashboard
frame → bespoke → pricing → FAQ. It reads as "another vibe-coded product."

The goal is to replace it with a site that feels **motion-driven, cinematic, fluid, and
technically deep** — the tier of site where visitors think "this has serious engineering
underneath." Treat the current marketing components as a proof of concept: **everything
in the marketing surface may be ripped out and rebuilt.** The plan below is the spec.

The product (for copy honesty): YouInc is a multi-tenant personal ERP. Users connect
their bank via Akahu (NZ open finance, read-only), transactions run through a real
double-entry ledger engine (rules routing, NZFCC fallback, suspense safety, idempotent
posting), stored per-tenant in Postgres with RLS isolation, Akahu tokens encrypted in
Supabase Vault. The dashboard is a configurable widget grid (net worth, runway,
cashflow, balance sheet, etc.).

## 1. Creative direction — "Dark terminal cinema"

**Concept:** The site's thesis IS its art direction. *You are a company.* The landing
page is a continuous scroll-driven film in which the visitor's financial life is
incorporated before their eyes, in three movements:

1. **Chaos** — raw transactions as a drifting particle field
2. **Order** — the double-entry engine organizes them into balanced streams
3. **Command** — the streams assemble into the live CFO dashboard

**Register:** Bloomberg terminal directed by Denis Villeneuve. Near-black, volumetric,
restrained. Data itself is the atmosphere. Swiss typographic discipline over cinematic
depth.

**Explicitly banned:** neon cyberpunk, crypto-glow, purple/indigo gradients, scanlines,
generic dark-mode-SaaS glassmorphism cards, decorative blobs, stock badge rows,
emoji-in-headings. No section may look like a default Tailwind/shadcn template.

**Signature pairing:** Fraunces (warm display serif, already a dependency) set very
large over the dark terminal world, with a monospace for ALL data/labels/ledger lines.
Serif display + mono data = "the annual report of you": financial print heritage meets
live terminal. This is the distinctive move — protect it.

## 2. Design system ("terminal" tokens)

Rebuild `marketing-tokens.css` in place (keep the `.mk` scope and `--mk-*` variable
names so shared consumers keep working, but redefine all values). Marketing pages force
dark: replace `useLightTheme` with a `useDarkTheme` equivalent (sets
`data-theme="dark"` on `<html>` for the app-widget embeds).

### 2.1 Palette

```css
.mk {
  /* canvas & surfaces — elevation via lightness steps + hairlines, not shadows */
  --mk-paper:      #0B0D10;   /* the void — cold near-black canvas */
  --mk-card:       #11141A;   /* surface-1 — panels, cards */
  --mk-surface-2:  #161B22;   /* surface-2 — raised elements, hovers */
  --mk-line:       rgba(235, 240, 245, 0.09);  /* hairline strokes */
  --mk-line-strong:rgba(235, 240, 245, 0.16);

  /* ink */
  --mk-ink:        #F2F1EC;   /* warm white — headings, primary text */
  --mk-soft:       #9BA1A8;   /* secondary text */
  --mk-faint:      #5C6269;   /* tertiary — mono labels, axis text */

  /* the ONE signal color — phosphor green, derived from brand #12a150 */
  --mk-accent:        #34D97B;  /* live data, CTAs, positive deltas ONLY */
  --mk-accent-strong: #4CF391;  /* hover/active */
  --mk-accent-dim:    #12A150;  /* large glow fields, charts at rest */
  --mk-accent-tint:   rgba(52, 217, 123, 0.10);
  --mk-accent-line:   rgba(52, 217, 123, 0.28);
  --mk-glow:          rgba(52, 217, 123, 0.14); /* WebGL/radial atmosphere only */

  /* semantic negative — debits/losses ONLY, never decoration */
  --mk-positive:      var(--mk-accent);
  --mk-negative:      #E56B52;
  --mk-negative-tint: rgba(229, 107, 82, 0.10);
  --mk-negative-line: rgba(229, 107, 82, 0.30);

  --mk-focus: var(--mk-accent);
}
```

Data-viz series (`--mk-dv-1..5`): rebalance the existing hues for dark canvas —
`#34D97B`, `#4FA3C7`, `#D9A648`, `#9C7FC9`, `#6B7280`; grid `var(--mk-line)`,
labels `var(--mk-faint)`, negative `var(--mk-negative)`.

Contrast requirement: all body text ≥ AA on its surface. `--mk-soft` on `--mk-paper`
must pass 4.5:1 (adjust lightness if needed — verify, don't trust these hex values
blindly).

### 2.2 Typography

Three families, each with a strict job (the third is justified — data IS the product):

| Role | Family | Usage |
|---|---|---|
| Display | **Fraunces** (opsz, 400 + 300; add `latin-400-italic` for emphasis moments) | Headlines, section openers, pull quotes. Never below 1.75rem. |
| Body | **Inter** 400/600 | Paragraphs, UI copy, buttons |
| Data | **IBM Plex Mono** 400/500 (add `@fontsource/ibm-plex-mono`) | ALL numbers, ledger rows, labels, eyebrows, timestamps, code, nav meta. Always `font-variant-numeric: tabular-nums`. |

Scale (fluid):

```css
--mk-text-hero:    clamp(3.25rem, 1.5rem + 7.5vw, 8.5rem);   /* Fraunces 300, tight leading 0.95 */
--mk-text-act:     clamp(2.25rem, 1.25rem + 4vw, 4.5rem);    /* act headlines */
--mk-text-section: clamp(1.6rem, 1.2rem + 1.6vw, 2.4rem);
--mk-text-base:    clamp(1rem, 0.95rem + 0.3vw, 1.125rem);
--mk-text-mono:    0.8125rem;  /* mono labels; letter-spacing 0.04em, often uppercase */
```

Eyebrow pattern (used everywhere): mono, uppercase, `--mk-faint`, with a leading index
like `01 / CHAOS` — the film's chapter markers.

### 2.3 Texture & atmosphere

- **Film grain:** one fixed full-viewport overlay, CSS `background-image` with a tiny
  tiling noise PNG (or SVG turbulence rendered to data URI), `opacity: 0.05`,
  `mix-blend-mode: overlay`, `pointer-events: none`. Marketing pages only.
- **Ledger hairlines:** sections sit on a faint 12-col grid of vertical hairlines
  (`--mk-line` at 50% of its alpha), like ledger paper in the dark. Subtle — visible
  only on close look.
- **Vignette:** soft radial darkening at viewport edges on film sections.
- No scanlines. No noise animation (static grain only).

### 2.4 Motion vocabulary

```css
--mk-dur-fast: 150ms;  --mk-dur-base: 300ms;  --mk-dur-slow: 700ms;  --mk-dur-cine: 1200ms;
--mk-ease-out:  cubic-bezier(0.16, 1, 0.3, 1);   /* expo-out — entrances */
--mk-ease-inout:cubic-bezier(0.65, 0, 0.35, 1);  /* scene transitions */
```

- Entrances: masked line reveals (headline lines clip up from a `overflow:hidden` wrap),
  stagger 60–90ms.
- Numbers: count-up with mono tabular nums (GSAP `textContent` snap or manual rAF).
- Buttons: designed hover/focus/active — accent underline sweep or fill wipe, 150ms;
  focus ring = 2px `--mk-focus` offset ring, always visible on keyboard focus.
- Compositor-only properties (`transform`, `opacity`, `clip-path`, `filter` sparingly).
- **`prefers-reduced-motion: reduce`:** every scene renders its final/static
  composition; no pinning, no scrub, no count-ups, no smooth scroll, no WebGL motion
  (static frame or backdrop image instead). This must be designed, not broken.

## 3. The landing film — act by act

Route `/` renders the new `MarketingPage`. Component per act, in
`src/components/marketing/film/` (one `ActNN*.tsx` + co-located CSS each). All narrative
copy lives in DOM text (SEO + a11y); heading hierarchy stays semantic (one `h1`, acts
use `h2`).

Copy voice: assured, precise, faintly cinematic. Short declaratives. No exclamation
marks, no "supercharge/unlock/seamless". Keep the existing headline
**"Run yourself like a company."** — it is the thesis. Prices and feature claims must
stay consistent with `config.ts` (see §7 constraints). Suggested copy beats are given
below; the implementer may refine within this voice.

### Act I — Chaos (hero)

- Full-viewport (100svh). WebGL particle field behind (scene A, §5): ~25k points
  drifting on curl noise, faint phosphor glints; occasional short-lived mono sprite
  labels (`-4.50 COFFEE`, `+2,847.00 SALARY`, `-220.00 POWER`) fading in/out near
  brighter particles (HTML overlay elements positioned from the scene, max ~6 live at
  once — cheaper and crisper than GL text).
- Foreground (HTML, renders before GL loads — this is the LCP element):
  - Eyebrow: `00 / PERSONAL ERP — LIVE BANK SYNC (NZ)`
  - `h1` Fraunces, `--mk-text-hero`: **Run yourself like a company.**
  - Sub (Inter, max ~34ch): "YouInc keeps a live double-entry ledger of your whole
    financial life — and shows you the CFO view: net worth, runway, cashflow, and the
    one thing to do next."
  - CTAs: primary "Start free" → `/signup`; secondary (ghost) "Watch the demo" → `/demo`.
  - Reassurance line (mono, faint): `NO CARD · READ-ONLY BANK ACCESS · LIVE IN 2 MINUTES`
- Header (see §4 shell) floats above.
- Scroll cue: mono `SCROLL` + a 1px animated line at the bottom center.
- Entrance timeline on load: eyebrow → masked headline lines → sub → CTAs → cue,
  total ≤ 1.4s. GL canvas fades in whenever ready, never blocking.
- Static fallback: pre-designed CSS backdrop — radial `--mk-glow` field + scattered
  1px dots (CSS/radial-gradients or an inline SVG), same composition.

### Act II — The Engine (pinned, scrubbed)

The credibility scene. Pin height ~300vh.

- GL scene B: the chaos field organizes — particles flow into horizontal streams, then
  each stream visibly **splits into a paired debit/credit lane** that converges,
  balanced. Driven by a single scroll-scrubbed progress uniform.
- HTML overlay synced to the same ScrollTrigger, three copy beats (each a masked
  reveal + fade-through):
  1. Eyebrow `01 / THE ENGINE` — "Every dollar gets an account." Under it, real-looking
    ledger rows materialize one by one in mono (date · payee · account path ·
    debit/credit columns), e.g.
    `2026-07-08  KŌKAKO CAFE   Expenses:Food:Coffee   4.50 |     `
    `2026-07-08  KŌKAKO CAFE   Assets:Bank:Everyday        |  4.50`
  2. "Every entry balances. Double-entry isn't retro — it's why the numbers never lie."
  3. "Rules route each transaction. Unknowns fall back to NZFCC categories, and anything
    uncertain lands in suspense — never silently wrong." (names the real engine
    features)
- End state: an ordered lattice of ledger lines, holding briefly before Act III.
- Reduced-motion/static: a composed spread — headline + a static block of ~8 balanced
  ledger rows with the three copy beats stacked; no pin.

### Act III — Command (the payoff)

Pin height ~250vh. The film's climax: the product assembles itself.

- The GL lattice condenses and dims; foreground widgets **snap in on scroll**, building
  the real dashboard: net worth (count-up), runway (chart draws itself left→right),
  cashflow (bars rise with stagger), balance sheet rows cascade in.
- Implementation: a dark-themed marketing replica frame (`CommandDeck.tsx`) laid out
  like the product, fed from `sampleDashboard.ts` data. Reuse real widget components
  where they drop in cleanly under `data-theme="dark"`; otherwise build faithful
  lightweight replicas (this is a designed marketing object, like the old
  `DashboardFrame`, so replicas are acceptable — visual fidelity to the real product
  matters more than code reuse).
- Copy beat: eyebrow `02 / COMMAND` — "The CFO view of you." + one line: "Net worth,
  runway, cashflow — live from your ledger, not a spreadsheet you abandoned in March."
- Releases from pin into Act IV with the assembled deck settling as a normal in-flow
  section; deck gets a slow parallax drift (±2%) while in view.
- Static: the fully assembled deck as a composed section.

### Act IV — Proof & pipeline (normal scroll)

Two designed sections, no pinning:

1. **The pipeline** — how-it-works as a terminal log, vertical timeline in mono:
   `$ connect akahu ............ read-only, 90 seconds` /
   `→ rules engine routing ..... 214 transactions posted` /
   `→ ledger balanced .......... assets = liabilities + equity` /
   `● dashboard live ........... net worth ticking`.
   Each line reveals on enter (IntersectionObserver / ScrollTrigger batch, non-scrub).
   Sub-copy explains the three steps in Inter.
2. **Security posture** — this product has real architecture; give it an editorial
   moment, not badges. Split layout: Fraunces statement "Built like infrastructure,
   because it is." + three mono-labelled entries: READ-ONLY — Akahu open-finance
   access, no payment scopes · ENCRYPTED — bank tokens sealed in Supabase Vault, never
   sent to the browser · ISOLATED — row-level security walls every tenant at the
   database. Link to `/security`.

### Act V — Concierge

Reframe the bespoke tier: eyebrow `03 / CONCIERGE`, headline "Your own engineering
department." Dark editorial layout for 2–3 showcase artifacts (rebuild
`ConciergeShowcase` content as framed "commissioned work" cards with mono spec
plates: brief → built → shipped). CTA "Book a call" → `BOOKING_URL`. Keep the honest
framing that artifacts are illustrative mock-ups of bespoke work.

### Act VI — Pricing

Four tiers rendered as **ledger entries**: a ruled mono table aesthetic rather than
floating cards — each tier a row-group with name (Fraunces small), price (mono, large),
features (Inter). Self-serve is the emphasized entry (accent hairline + tint field).
Content from `PRICING` in `config.ts` unchanged; pinned strings `"NZD $15"` and
`"From NZD $149"` must appear exactly. CTAs: demo → `/demo`, free/self-serve →
`/signup`, concierge → booking URL. Link to `/pricing` for the full comparison.

### Act VII — Close + FAQ + footer

- Final CTA: the particle field returns (scene A reused, denser center), one line
  (Fraunces, act-size): **"Incorporate yourself."** + primary CTA "Start free" and mono
  sub `FREE TIER · NO CARD · 2 MINUTES`.
- FAQ: keep existing content model from `Faq.tsx`, restyled — mono question index
  (`Q.01`), hairline dividers, designed disclosure motion (grid-template-rows or
  clip-path, not height animation).
- Footer: "system footer" — dense mono link grid of all routes, plus a live status
  line `● ALL SYSTEMS OPERATIONAL` linking to `/status`, brand lockup
  (`youinc-lockup-inverted.svg` from `brand/logos/`), and a long horizontal rule of
  ledger hairlines.

## 4. Shared shell

- **Header:** fixed, transparent over Act I, gains `--mk-paper`/blur backdrop +
  bottom hairline after scroll threshold. Left: inverted lockup. Center/right: nav
  (Product, Pricing, Demo, Custom builds — mono, small caps) + "Start free" accent
  button. Mobile: full-screen overlay menu, mono index numbers per item, staggered
  reveal. Keyboard accessible, focus trapped while open.
- **Footer:** as Act VII.
- **Page transitions:** keep simple — 200ms fade via router; no elaborate route
  transitions (risk > reward).

## 5. WebGL architecture

- **Dependency:** `three` (latest), imported ONLY via dynamic `import()` from an idle
  callback after hydration. No three.js code in the initial chunk. GSAP + ScrollTrigger
  and `lenis` likewise dynamically imported in a client-only effect.
- **`CinematicCanvas`** (`film/gl/CinematicCanvas.tsx`): one fixed, full-viewport
  `<canvas>` behind all content (`position: fixed; inset: 0; z-index: 0`,
  content wrapper `z-index: 1`). Single renderer, single rAF loop.
- **Scene manager** (`film/gl/sceneManager.ts`): acts register scene modules
  `{ init(ctx), update(dt, uniforms), resize(), dispose() }` keyed to scroll ranges
  (measured from act DOM elements). Manager crossfades scene visibility/uniforms as
  ranges enter/exit. Only the active scene(s) render.
- **The particle system** (shared by scenes A/B/III-handoff): one
  `THREE.Points` / instanced buffer of ~25k particles. Three position attribute sets:
  `aChaos` (curl-noise field), `aStream` (balanced debit/credit lanes), `aLattice`
  (ordered grid). Vertex shader mixes between them with two scroll-driven uniforms
  (`uMorph1`: chaos→streams, `uMorph2`: streams→lattice) plus a time uniform for
  ambient drift. Fragment: soft round points, additive blending, phosphor green ramp
  (`--mk-accent-dim` → `--mk-accent`), depth-based alpha falloff. Scroll uniforms are
  set from ScrollTrigger scrub callbacks — GSAP never touches the DOM for this.
- **Performance:** DPR capped at `min(devicePixelRatio, 1.75)`; pause rAF when
  document hidden or no film section in viewport; `powerPreference:
  "high-performance"`; dispose on route unmount. Target 60fps on an M-series laptop,
  degrade gracefully (halve particle count) if frame time > 22ms sustained
  (simple rolling average check).
- **Degradation ladder:** (1) no WebGL context / `prefers-reduced-motion` /
  `navigator.deviceMemory < 4` → static CSS/SVG backdrops per act; (2) mobile → lower
  particle count (~8k), no pointer interaction; (3) full experience. Detection in one
  `lib/capabilities.ts`.
- **Bundle budget:** initial route JS (pre-GL) ≤ 150kb gz; GL+GSAP lazy chunks ≤ 200kb
  gz additional. Hero headline is server-rendered HTML text — LCP < 2.5s, CLS < 0.1
  (canvas is fixed behind content, never shifts layout).

## 6. Beyond the landing page

### 6.1 Secondary marketing pages (system, no scroll-cinema)

All on the new tokens + shell; micro-motion only (reveals, hovers):

- **`/pricing`** — comparison table (`PRICING_COMPARISON`) as a full ledger table:
  sticky mono header row, hairline rules, accent ticks. Tier cards above in Act VI
  style.
- **`/demo`** — dark shell framing the real dashboard (which now runs dark by
  default, §6.2): mono chrome around it (`DEMO · SAMPLE DATA · READ-ONLY`), short
  intro, CTA to signup.
- **`/widgets`** — catalogue in a bento composition (varied cell sizes, not a uniform
  grid), each widget in a dark panel with mono spec label.
- **`/custom-builds`** — expanded Act V treatment: editorial case-study layout.
- **`/use-cases`, `/compare`, `/about`, `/security`, `/docs`, `/help`, `/changelog`,
  `/roadmap`, `/status`, `/contact`, legal pages** — restyle
  `StaticMarketingPage`/`static-page.css` + `staticPages.tsx` to the dark editorial
  template: mono eyebrow + Fraunces title + measured Inter prose (~68ch), hairline
  TOC where long. Content itself unchanged unless trivially improved.
- `/status` gets the live-status styling hook (`● OPERATIONAL` mono line).

### 6.2 App + auth reskin (dark becomes home)

- Default `data-theme` becomes `dark` for the app (workspace + dashboard); light
  remains a working user toggle. Update the app's dark token values (`app.css` /
  `workspace.css` / `dashboard.css` dark blocks) to THIS palette (canvas `#0B0D10`,
  surfaces, hairlines, phosphor accent, semantic red) so marketing and product are one
  world. Widgets must remain legible — charts pull the rebalanced `--mk-dv-*`-style
  series.
- **Auth flow** (`/signin*`, `/signup*`, `auth.confirm`, `/onboarding`): restyle to
  the terminal system — dark canvas, grain, centered narrow column, Fraunces step
  titles, mono step indicators (`STEP 02 / 04 — CREDENTIAL`), inputs as dark fields
  with hairline borders + accent focus ring. Keep the flow logic, passkey ceremonies,
  and route structure EXACTLY as-is; this phase is styling only.
- The signup transition from marketing → auth should feel continuous (same canvas,
  same grain).

## 7. Constraints & invariants (do not violate)

1. `config.ts` stays the single source of marketing copy/pricing structure;
   `config.test.ts` pins `"NZD $15"` and `"From NZD $149"` — keep tests and strings in
   sync deliberately. Feature claims stay honest (no inventing gated features).
2. Do not touch: server code (`src/server/`), routes' loader/auth logic, session gate
   (`start.ts`), SEO/JSON-LD wiring in route `head`s (update title/description copy
   only if copy changes), sitemap.
3. `/demo` must keep using `DEMO_WIDGET_IDS` allowlist + its own storage key; the four
   session-gated widget ids stay excluded.
4. `.mk section` padding trap: widgets render `<section>`s — keep scoped resets where
   real widgets embed in marketing pages.
5. Accessibility: semantic HTML per web rules; one `h1`/page; all narrative copy as DOM
   text; keyboard nav works everywhere (Lenis must not break it); visible focus states;
   AA contrast; full reduced-motion experience.
6. Coding style: files < 800 lines, co-located CSS per component, tokens only (no
   hardcoded palette values outside the tokens file), immutable patterns, no
   `console.log`.
7. E2E specs (`e2e/landing.spec.ts`, `e2e/marketing-pages.spec.ts`) must pass —
   update selectors/assertions to the new DOM as needed; run Playwright with
   `reducedMotion: 'reduce'` emulation for determinism.
8. `pnpm build` (vite build + tsc) must pass. `pnpm test` must pass.
9. New deps allowed: `gsap`, `lenis`, `three`, `@types/three`,
   `@fontsource/ibm-plex-mono`, `@fontsource/fraunces` italic/300 subsets. Nothing
   else without strong justification. All motion deps dynamically imported.

## 8. File organization (target)

```
src/components/marketing/
├── system/            # tokens.css (rebuilt), grain, primitives (Button, Eyebrow,
│                      # SectionShell, MonoLabel), useDarkTheme.ts
├── shell/             # MarketingHeader, MarketingFooter (+css)
├── film/              # the landing acts
│   ├── Act01Hero.tsx / .css
│   ├── Act02Engine.tsx / .css
│   ├── Act03Command.tsx / CommandDeck.tsx / .css
│   ├── Act04Pipeline.tsx / Act04Security.tsx / .css
│   ├── Act05Concierge.tsx / .css
│   ├── Act06Pricing.tsx / .css
│   ├── Act07Close.tsx / Faq.tsx / .css
│   └── gl/            # CinematicCanvas.tsx, sceneManager.ts, particles/, shaders,
│                      # staticBackdrops.css
├── pages/             # pricing, demo shell, widgets, custom-builds compositions
├── MarketingPage.tsx  # act sequence
├── config.ts          # kept (copy updated in place, tests updated together)
├── sampleDashboard.ts # kept as data source
└── staticPages.tsx    # restyled template
hooks/                 # useScrollScene.ts (GSAP/ScrollTrigger lifecycle),
                       # useLenis.ts, useCapabilities.ts
lib/                   # capabilities.ts, motion.ts (shared timeline helpers)
```

Delete superseded components/CSS once replaced (Hero, LiveProofStrip, HowItWorks,
DashboardFrame, BespokeSection, Pricing/PricingTable in their old form, useLightTheme,
old token values). No dead files left behind.

## 9. Phases (each independently shippable, commit at each boundary)

Work on a branch `redesign/incorporation`. Commit per phase with conventional
messages; do not push.

- **Phase 0 — System.** New tokens, fonts (Plex Mono + Fraunces subsets), grain +
  hairline primitives, dark shell (header/footer), `useDarkTheme`, static backdrops,
  capabilities lib. Old pages still render (may look transitional). Build + tests green.
- **Phase 1 — The film, static-first.** All seven acts fully designed and composed
  WITHOUT pin/scrub/WebGL (the reduced-motion experience is the deliverable). Landing
  is already a strong, coherent dark editorial page. Update e2e selectors. Build +
  tests + e2e green.
- **Phase 2 — Choreography.** Lenis + GSAP/ScrollTrigger: entrance timelines, pinned
  scrub for Acts II/III, count-ups, log reveals. Reduced-motion path = Phase 1
  output.
- **Phase 3 — WebGL.** CinematicCanvas + scene manager + particle morphs for Acts
  I/II/III/VII, degradation ladder, perf guards.
- **Phase 4 — Secondary pages.** /pricing, /demo shell, /widgets, /custom-builds,
  static template restyle.
- **Phase 5 — App + auth reskin.** Dark-default app tokens, auth flow restyle,
  marketing→auth continuity.

## 10. Verification (every phase; full pass at the end)

1. `pnpm test` and `pnpm build` (typecheck included) — green.
2. `pnpm test:e2e` if the local Supabase stack is available (`supabase start` from repo
   root needs Docker); otherwise run the public-page specs that don't need auth and
   note what was skipped.
3. Playwright screenshots of `/`, `/pricing`, `/demo`, `/widgets`, `/signin`,
   `/onboarding` at 320 / 768 / 1024 / 1440 wide (reduced-motion emulation), reviewed
   for: no horizontal overflow, no unstyled flashes, hierarchy reads, both the
   motion and static compositions look intentional.
4. Manual smoke of the motion path in a real browser where possible: 60fps scrub,
   no layout shift from the canvas, tab-hidden pauses rendering.
5. Contrast spot-check (`--mk-soft`/`--mk-faint` on canvas, accent on canvas).
6. Bundle check: initial landing JS ≤ 150kb gz before lazy chunks (inspect
   `vite build` output).
