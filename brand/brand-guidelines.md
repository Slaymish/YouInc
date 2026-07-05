# YouInc — Brand Guidelines

> **Run yourself like a company.**

This is the single source of truth for the YouInc visual identity. Colours,
type, and spacing here are kept in sync with the product's live design tokens
(`frontend/src/components/marketing/marketing-tokens.css`) so the marketing site,
the app, and brand collateral stay coherent.

---

## 1. The idea

YouInc treats a person like a company — a personal ERP / executive dashboard for
your own finances. The logo encodes that in two parts:

- **`You`** — mixed case, human, the individual.
- **`INC`** — set in a box, like an incorporation stamp. The box is the "company"
  wrapper placed around _you_.

The box's left edge doubles as the divider between the two words. Keep this
concept intact: **`You` stays approachable (mixed case); `INC` stays boxed.**

---

## 2. Logo variants

All masters are outlined SVG (no font dependency) in `logos/`. Raster exports are
in `logos/png/`. View everything at a glance in [`preview.html`](./preview.html).

| File | Use it for |
|------|-----------|
| `youinc-wordmark.svg` | **Primary.** Ink on light backgrounds. |
| `youinc-wordmark-inverted.svg` | Paper on dark / photographic backgrounds. |
| `youinc-wordmark-filled.svg` | Solid-box variant — strong, high-contrast headers, merch, stamps. Light backgrounds. |
| `youinc-wordmark-mono-white.svg` | Pure white, single-colour (print, watermarks, over imagery). |
| `youinc-lockup.svg` | **Wordmark + tagline.** Default for first-impression surfaces (hero, cover slides, footer). Ink on light. |
| `youinc-lockup-inverted.svg` | Lockup, paper on dark. |
| `youinc-icon.svg` | App icon / favicon. Ink tile, white `Y` (you, inside the company box). |
| `youinc-icon-accent.svg` | Icon on brand green — social avatars, playful contexts. |
| `youinc-icon-outline.svg` | Light-tile icon for light UI chrome. |

**Choosing between wordmark and lockup:** use the **lockup** when the brand is
being introduced (landing hero, pitch cover, business card front). Use the
**wordmark** everywhere the tagline would be redundant or too small to read (nav
bars, footers, repeated headers).

> **Full per-logo rules** — exactly which background, context, and size each
> variant is for — live in [guidelines/logo-usage.md](./guidelines/logo-usage.md).

---

## 3. Clear space & minimum size

- **Clear space:** keep padding of at least the **cap height of `Y`** on all sides
  of the wordmark/lockup. Nothing (text, edges, other logos) inside that margin.
- **Minimum size:**
  - Wordmark: **120 px** wide on screen / 25 mm in print.
  - Lockup: **200 px** wide — below this the tagline stops being legible; switch to
    the wordmark instead.
  - Icon: works down to **16 px** (`Y` monogram survives; the tagline never appears
    in the icon).

---

## 4. Misuse — don't

- Don't remove the box around `INC`, or box `You` as well.
- Don't set `INC` in lowercase, or `You` in all caps — the case contrast is the concept.
- Don't recolour the wordmark outside the palette (no gradients, no photos inside letters).
- Don't stretch, condense, rotate, or add drop shadows / outlines / bevels.
- Don't rebuild it in a different typeface — use the SVG masters. To change type or
  spacing, edit the generator (see `tools/`), never hand-tweak the paths.
- Don't place the ink wordmark on a dark or busy background — use the inverted or
  mono-white variant.

---

## 5. Colour

Core palette (matches the product design tokens):

| Token | Hex | Role |
|-------|-----|------|
| Ink | `#111111` | Primary logo/text, near-black. |
| Paper | `#fbfbf9` | Primary light background (warm off-white). |
| Accent | `#12a150` | Brand green — gains, positives, primary CTA, accent icon. |
| Accent strong | `#0e8a44` | Hover / pressed / darker accent. |
| Accent tint | `#e7f4ec` | Accent backgrounds, highlights. |
| Negative | `#c0492f` | Losses / down / destructive. Only red in the system. |
| Soft | `#55534d` | Secondary text, captions. |
| Line | `#e3e3dd` | Borders, dividers, hairlines. |
| Card | `#ffffff` | Raised surfaces on paper. |

Rules of thumb:
- The identity is **ink-on-paper first**; green is an **accent**, not a fill for the logo.
- One green, one red — never introduce other reds/greens (data-viz uses the
  `--mk-dv-*` extended set: teal `#1f6f8b`, ochre `#c98a2b`, violet `#7d5ba6`, warm
  grey `#b0aea6`).

---

## 6. Typography

Two self-hosted families (via `@fontsource`, already in the app):

| Family | Weights | Role |
|--------|---------|------|
| **Inter** (sans) | 400 / 600 / 700 | Everything: UI, body, and the **logo wordmark** (700). Tagline is 600. |
| **Fraunces** (serif) | 400 | Display / editorial headlines on marketing surfaces. Adds warmth against Inter. |

- Logo wordmark: **Inter 700**, `You` tracked `-2`, `INC` tracked `+2` (values baked
  into the outlines).
- Tagline: **Inter 600**, wide tracking, always uppercase, justified to the wordmark
  width in the lockup.
- Headlines (marketing): Fraunces 400, tight tracking (`-0.025em`).
- Body: Inter 400, line-height `1.6`.

Fallback stacks (when webfonts aren't available):
`Inter, ui-sans-serif, system-ui, -apple-system, sans-serif` and
`Fraunces, Georgia, "Times New Roman", serif`.

---

## 7. The icon / favicon

The icon is the `Y` monogram (you) centred in a rounded square (the company box).

- App icon / dark UI: `youinc-icon.svg` (ink tile). PNGs: `logos/png/youinc-icon-{16,32,180,512}.png`.
- Social avatar / accent: `youinc-icon-accent.svg`.
- Light UI chrome: `youinc-icon-outline.svg`.
- Rounded-corner radius is ~22% of the tile (iOS-friendly). For a hard-square
  favicon, regenerate with `rounded=False` in the generator.

---

## 8. Editing the logos

The SVGs are **generated**, not drawn by hand — that's how the spacing stays exact.
See [`tools/README.md`](./tools/README.md) to change strings, type, colours, or
geometry and regenerate every variant + all exports in one pass.
