# brand/tools — logo generator

The YouInc logos are **generated as outlined SVG**, not drawn by hand. This keeps
the letter spacing pixel-exact and independent of whether Inter is installed on
the viewer's machine.

## Pipeline

```
capture-positions.mjs  →  positions.json  →  generate.py  →  logos/*.svg
                                                          →  build-assets.mjs  →  logos/png/*, preview.html
```

1. **`capture-positions.mjs`** renders the type runs (`You`, `INC`, tagline) in a
   real browser using self-hosted Inter and records each glyph's exact x position
   (so real kerning + tracking are preserved). Writes `positions.json`.
2. **`generate.py`** loads Inter via `fonttools`, converts each glyph to a vector
   path placed at those positions, draws the box, and writes every SVG variant.
   All geometry (box padding, offsets, tagline scale) lives here as documented
   constants — nudge and re-run.
3. **`build-assets.mjs`** rasterises the SVGs to `logos/png/` (transparent PNGs +
   favicon sizes) and regenerates the `preview.html` contact sheet.

## Regenerate everything

Requires Node (uses the frontend's Playwright + `@fontsource/inter`) and Python
with `fonttools`:

```sh
# one-time: python deps for outlining
python3 -m venv /tmp/brandvenv
/tmp/brandvenv/bin/pip install fonttools brotli

# from the repo root:
node brand/tools/capture-positions.mjs      # only if you changed strings/type/size/tracking
/tmp/brandvenv/bin/python brand/tools/generate.py
node brand/tools/build-assets.mjs
```

## Common edits

- **Change the tagline or wordmark text / weight / tracking:** edit the `runs`
  array in `capture-positions.mjs`, re-run all three steps.
- **Adjust box padding or the You↔INC gap:** edit `BOX_X/BOX_W/BOX_Y/BOX_H` and
  `INC_OFFSET` in `generate.py`, then run steps 2–3 (no re-capture needed).
- **Change colours:** edit the token constants (`INK/PAPER/ACCENT/WHITE`) in
  `generate.py`, run steps 2–3. Keep them in sync with `brand-guidelines.md`.
- **Hard-square favicon (no rounded corners):** call `icon(..., rounded=False)`.

> The `/tmp/brandvenv` path is just a throwaway venv; put it wherever you like.
> `positions.json` is committed so the SVGs can be regenerated without a browser
> as long as the type spec is unchanged.
