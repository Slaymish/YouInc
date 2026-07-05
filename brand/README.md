# YouInc — Brand

Central home for the YouInc identity: logos, exports, and the guidelines that
govern them. **Run yourself like a company.**

```
brand/
├── brand-guidelines.md     ← read this first (concept, colour, type, spacing)
├── guidelines/
│   └── logo-usage.md       ← exactly when/where to use each logo (bg, context, size)
├── preview.html            ← visual contact sheet of every logo (light + dark)
├── logos/                  ← SVG masters (outlined, font-independent)
│   ├── youinc-wordmark*.svg
│   ├── youinc-lockup*.svg
│   ├── youinc-icon*.svg
│   └── png/                ← raster exports (transparent PNG + favicon sizes)
└── tools/                  ← generator + exporters (how the SVGs are produced)
```

## Quick pick

- **Which logo do I use?** [`guidelines/logo-usage.md`](./guidelines/logo-usage.md)
  — per-logo background, context, and size rules.
- **Need the logo?** Grab an SVG from [`logos/`](./logos/) — see the variant table
  in [brand-guidelines.md](./brand-guidelines.md#2-logo-variants).
- **Need a PNG** (slides, social, email)? [`logos/png/`](./logos/png/).
- **Favicon / app icon?** `logos/png/youinc-icon-{16,32,180,512}.png` or the SVG.
- **See them all together?** Open [`preview.html`](./preview.html) in a browser.

## Colours & type at a glance

- Ink `#111111` · Paper `#fbfbf9` · Accent green `#12a150` · Negative `#c0492f`
- **Inter** (sans, UI + logo) · **Fraunces** (serif, display)

Full palette, tokens, and rules in [brand-guidelines.md](./brand-guidelines.md).

## Changing the logo

The SVGs are generated so spacing stays exact — don't hand-edit the paths. See
[`tools/README.md`](./tools/README.md).
