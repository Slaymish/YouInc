#!/usr/bin/env python3
"""Generate the outlined (font-independent) YouInc logo SVGs.

Reads tools/positions.json (exact per-glyph x positions captured from a real
browser, so Inter's kerning + tracking are preserved) and converts each glyph
to a vector <path> with fonttools. Emits every brand/logos/*.svg variant.

This is the source of truth for the SVG masters. To regenerate:

    python3 -m venv /tmp/brandvenv
    /tmp/brandvenv/bin/pip install fonttools brotli
    node brand/tools/capture-positions.mjs        # only if strings/type changed
    /tmp/brandvenv/bin/python brand/tools/generate.py
    node brand/tools/build-assets.mjs             # PNGs + preview.html

Geometry is documented inline; nudge the BOX_* / *_OFFSET constants and re-run.
"""
import json
import os

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

TOOLS = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(TOOLS)
FONT_DIR = os.path.join(BRAND, "..", "frontend", "node_modules", "@fontsource", "inter", "files")
FONTS = {
    600: TTFont(os.path.join(FONT_DIR, "inter-latin-600-normal.woff2")),
    700: TTFont(os.path.join(FONT_DIR, "inter-latin-700-normal.woff2")),
}

# ── brand tokens (kept in sync with brand-guidelines.md) ────────────────
INK = "#111111"
PAPER = "#fbfbf9"
WHITE = "#ffffff"
ACCENT = "#12a150"

with open(os.path.join(TOOLS, "positions.json")) as f:
    POS = json.load(f)


def upm(weight):
    return FONTS[weight]["head"].unitsPerEm


def gname(weight, ch):
    return FONTS[weight].getBestCmap()[ord(ch)]


def run_path(run_key, x_offset=0.0, baseline=0.0):
    """Outline a measured run into one path 'd'. Glyphs land at the browser
    x (kerning/tracking baked in), scaled size/upm, y-flipped about baseline."""
    run = POS[run_key]
    weight, size = run["weight"], run["size"]
    scale = size / upm(weight)
    gs = FONTS[weight].getGlyphSet()
    d = []
    for c in run["chars"]:
        if c["ch"] == " ":
            continue
        pen = SVGPathPen(gs)
        gs[gname(weight, c["ch"])].draw(TransformPen(pen, (scale, 0, 0, -scale, x_offset + c["x"], baseline)))
        seg = pen.getCommands()
        if seg:
            d.append(seg)
    return " ".join(d)


def glyph_bounds(weight, ch, size):
    scale = size / upm(weight)
    gs = FONTS[weight].getGlyphSet()
    bp = BoundsPen(gs)
    gs[gname(weight, ch)].draw(bp)
    x0, y0, x1, y1 = bp.bounds
    return (x0 * scale, y0 * scale, x1 * scale, y1 * scale)


def single_glyph_path(weight, ch, size, tx, baseline):
    scale = size / upm(weight)
    gs = FONTS[weight].getGlyphSet()
    pen = SVGPathPen(gs)
    gs[gname(weight, ch)].draw(TransformPen(pen, (scale, 0, 0, -scale, tx, baseline)))
    return pen.getCommands()


def write(name, svg):
    path = os.path.join(BRAND, "logos", name)
    with open(path, "w") as f:
        f.write(svg.strip() + "\n")
    print("wrote logos/%s" % name)


# ── wordmark geometry (baseline at y=0) ─────────────────────────────────
INC_OFFSET = 265.0                       # "INC" x-offset (after "You")
YOU_D = run_path("you", 0.0, 0.0)
INC_D = run_path("inc", INC_OFFSET, 0.0)

BOX_X, BOX_W = 239.0, 272.0              # box hugs INC with ~26px side padding
BOX_Y, BOX_H = -105.0, 123.0            # balanced padding around cap height
STROKE = 5.0
WORD_RIGHT = BOX_X + BOX_W              # 511
WV = "-8 %d %d %d" % (BOX_Y - STROKE / 2 - 5, WORD_RIGHT + STROKE + 16, abs(BOX_Y) + 5 + STROKE + 20)


def wordmark(you_fill, inc_fill, box_stroke, box_fill="none", inc_over_fill=None):
    p = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" role="img" aria-label="YouInc">' % WV]
    p.append('  <path d="%s" fill="%s"/>' % (YOU_D, you_fill))
    if box_fill != "none":
        p.append('  <rect x="%s" y="%s" width="%s" height="%s" fill="%s"/>' % (BOX_X, BOX_Y, BOX_W, BOX_H, box_fill))
        p.append('  <path d="%s" fill="%s"/>' % (INC_D, inc_over_fill))
    else:
        p.append('  <path d="%s" fill="%s"/>' % (INC_D, inc_fill))
        p.append('  <rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="%s"/>' % (BOX_X, BOX_Y, BOX_W, BOX_H, box_stroke, STROKE))
    p.append("</svg>")
    return "\n".join(p)


# ── lockup (wordmark + tagline justified to wordmark width) ─────────────
TAG_SCALE = WORD_RIGHT / POS["tag"]["total"]
TAG_D = run_path("tag", 0.0, 0.0)
TAG_BASELINE = 56.0
LV = "-8 %d %d %d" % (BOX_Y - STROKE / 2 - 5, WORD_RIGHT + STROKE + 16, abs(BOX_Y) + 5 + STROKE + int(TAG_BASELINE) + 30)


def lockup(fill):
    return "\n".join([
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" role="img" aria-label="YouInc — Run yourself like a company.">' % LV,
        '  <path d="%s" fill="%s"/>' % (YOU_D, fill),
        '  <path d="%s" fill="%s"/>' % (INC_D, fill),
        '  <rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="%s"/>' % (BOX_X, BOX_Y, BOX_W, BOX_H, fill, STROKE),
        '  <g transform="translate(0 %s) scale(%.5f)"><path d="%s" fill="%s"/></g>' % (TAG_BASELINE, TAG_SCALE, TAG_D, fill),
        "</svg>",
    ])


# ── icon (monogram "Y" = you, inside the incorporation box/tile) ────────
def icon(tile_fill, letter_fill, rounded=True):
    S, size = 256.0, 168.0
    R = 56.0 if rounded else 0.0
    x0, y0, x1, y1 = glyph_bounds(700, "Y", size)
    tx = (S - (x1 - x0)) / 2 - x0
    baseline = (S + (y1 - y0)) / 2
    yd = single_glyph_path(700, "Y", size, tx, baseline)
    return "\n".join([
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" role="img" aria-label="YouInc">' % (S, S),
        '  <rect x="0" y="0" width="%d" height="%d" rx="%d" fill="%s"/>' % (S, S, R, tile_fill),
        '  <path d="%s" fill="%s"/>' % (yd, letter_fill),
        "</svg>",
    ])


write("youinc-wordmark.svg", wordmark(INK, INK, INK))
write("youinc-wordmark-inverted.svg", wordmark(PAPER, PAPER, PAPER))
write("youinc-wordmark-filled.svg", wordmark(INK, None, None, box_fill=INK, inc_over_fill=WHITE))
write("youinc-wordmark-mono-white.svg", wordmark(WHITE, WHITE, WHITE))
write("youinc-lockup.svg", lockup(INK))
write("youinc-lockup-inverted.svg", lockup(PAPER))
write("youinc-icon.svg", icon(INK, WHITE))
write("youinc-icon-accent.svg", icon(ACCENT, WHITE))
write("youinc-icon-outline.svg", icon(PAPER, INK))
print("done")
