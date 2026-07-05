# YouInc — Logo Usage Guide

Exactly **when and where** to use each logo: background, context, size, and the
cases to avoid. For the concept, palette, and type rules see
[../brand-guidelines.md](../brand-guidelines.md). See every asset side by side in
[../preview.html](../preview.html).

There are three families:

- **Lockup** — wordmark **+ tagline**. First impressions.
- **Wordmark** — `You INC` only. Everyday branding.
- **Icon** — `Y` monogram in a tile. Square/small spaces.

---

## Pick in 5 seconds

```diagram
                    ╭───────────────────────────────╮
                    │  How much room + what job?     │
                    ╰───────────────┬───────────────╯
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                        ▼
   Square / tiny slot     Wide, introducing brand    Wide, brand already known
   (≤ tagline unreadable)  (hero, cover, card front)  (nav, footer, headers)
            │                       │                        │
            ▼                       ▼                        ▼
         ICON                    LOCKUP                   WORDMARK
            │                       │                        │
   then pick by background ───────────────────────────────────┐
                                                               ▼
              Light bg → default/ink    Dark bg → inverted    Single-colour → mono-white
```

Then match the **background**:

| Background | Wordmark | Lockup | Icon |
|-----------|----------|--------|------|
| Light / paper (`#fbfbf9`, white) | `youinc-wordmark` | `youinc-lockup` | `youinc-icon` (or `-outline`) |
| Dark / ink (`#111`) or photo | `youinc-wordmark-inverted` | `youinc-lockup-inverted` | `youinc-icon` |
| Brand green / colour | `youinc-wordmark-mono-white` | — | `youinc-icon` |
| One-colour print / emboss / watermark | `youinc-wordmark-mono-white` (or `-filled`) | — | `youinc-icon-outline` |

---

## Lockup

### `youinc-lockup.svg` — primary lockup
- **What:** `You INC` with the "RUN YOURSELF LIKE A COMPANY." tagline justified to
  the wordmark width. The fullest expression of the brand.
- **Background:** light / paper only. Ink artwork.
- **Use it for:** landing-page hero, pitch-deck / proposal cover, homepage footer,
  business-card front, email signature header, the top of onboarding.
- **Minimum size:** **200 px** wide (≈ 55 mm print). Below this the tagline stops
  being legible — drop to the wordmark instead.
- **Don't:** use in nav bars or any repeated/small placement (tagline becomes
  noise); don't place on dark or busy backgrounds (use the inverted lockup).

### `youinc-lockup-inverted.svg` — lockup on dark
- **What:** the primary lockup in paper/white.
- **Background:** dark / ink surfaces, dark hero sections, photography with a dark
  area behind it.
- **Use it for:** dark-themed hero/footer, slide covers on dark, social share cards.
- **Minimum size:** **200 px** wide.
- **Don't:** place on light or mid-tone backgrounds where white loses contrast.

---

## Wordmark

### `youinc-wordmark.svg` — primary wordmark ⭐
- **What:** `You INC`, ink, boxed `INC`. The default mark for almost everything.
- **Background:** light / paper (`#fbfbf9`, `#ffffff`) and light neutrals.
- **Use it for:** site nav / header, footer, document headers, app top bar,
  invoices, anywhere the tagline would be redundant or too small.
- **Minimum size:** **120 px** wide (≈ 25 mm print).
- **Don't:** put on dark, coloured, or photographic backgrounds — switch variant.

### `youinc-wordmark-inverted.svg` — wordmark on dark
- **What:** wordmark in paper/white.
- **Background:** dark / ink surfaces and dark photos.
- **Use it for:** dark nav bars/footers, dark app chrome, dark slide headers.
- **Minimum size:** **120 px** wide.
- **Don't:** use on light or low-contrast mid-tone backgrounds.

### `youinc-wordmark-filled.svg` — solid-box wordmark
- **What:** `INC` reversed out of a solid ink block instead of an outlined box —
  heavier, punchier, reads well tiny and when printed/stamped.
- **Background:** light / paper.
- **Use it for:** merch (tees, stickers, caps), stamps/seals, bold section headers,
  packaging, favicons where the outline box would thin out, high-impact marketing.
- **Minimum size:** **110 px** wide (survives smaller than the outline version).
- **Don't:** pair next to the outlined wordmark in the same lockup (pick one box
  style per surface); don't use on dark (the ink `You` disappears — use mono-white).

### `youinc-wordmark-mono-white.svg` — single-colour white
- **What:** the entire wordmark (incl. box outline) in one flat white.
- **Background:** brand green, photography, ink, or any single-colour reproduction.
- **Use it for:** logo over imagery, on the accent-green fill, watermarks,
  one-colour print, embossing/etching, partner co-branding strips.
- **Minimum size:** **120 px** wide.
- **Don't:** use on light backgrounds (invisible); don't recolour it — for other
  single colours, regenerate rather than filling by hand.

---

## Icon

The icon is the `Y` monogram (you) inside the rounded "company box". Never carries
the tagline. Works down to **16 px**.

### `youinc-icon.svg` — app icon / favicon ⭐
- **What:** ink tile, white `Y`. The default square mark.
- **Background:** anything — the tile provides its own contrast (best on light or
  dark; the tile edge is visible on both).
- **Use it for:** favicon, PWA/app icon, macOS/iOS/Android launcher, avatar where
  a dark mark is wanted, notification badge, browser tab.
- **Sizes provided:** `png/youinc-icon-{16,32,180,512}.png` (16 favicon, 32 tab,
  180 Apple touch, 512 PWA/store). SVG scales to any size.
- **Don't:** stretch to non-square; don't drop the tile and float a bare `Y`.

### `youinc-icon-accent.svg` — accent icon
- **What:** brand-green tile, white `Y`.
- **Background:** light or neutral surfaces where you want a pop of brand colour.
- **Use it for:** social profile avatars, app store listing, playful/marketing
  contexts, feature spot illustrations.
- **Minimum size:** **24 px** (green needs a touch more size than ink to read).
- **Don't:** use on green or red backgrounds (colour clash / low contrast).

### `youinc-icon-outline.svg` — light-tile icon
- **What:** paper tile, ink `Y` — the light-mode counterpart.
- **Background:** dark surfaces (so the light tile stands out), or light UI chrome
  where a filled ink tile would feel too heavy.
- **Use it for:** dark-theme headers/sidebars, light-on-light UI where you want the
  tile outline rather than a solid black square.
- **Minimum size:** **24 px**.
- **Don't:** place on paper/white without the surrounding surface providing
  contrast (the tile blends) — prefer the ink `youinc-icon` there.

---

## Clear space & universal don'ts

- **Clear space:** keep a margin of at least the **cap height of `Y`** around any
  logo. Nothing intrudes into that zone.
- Don't recolour outside the palette, add gradients/shadows/outlines, rotate,
  stretch, condense, or rebuild in another typeface.
- Don't remove or add boxes, change the `You`/`INC` case, or alter spacing — edit
  the generator (`../tools/`) and regenerate instead of touching the SVGs.

## File format cheat-sheet

- **Web, app, print, anything scalable →** use the **SVG** from `../logos/`.
- **Slides, email, social, raster-only tools →** use the **PNG** from
  `../logos/png/` (`@2x` for wordmarks/lockups; sized files for icons).
