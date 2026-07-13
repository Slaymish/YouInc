import "./atmosphere.css";

/**
 * The fixed atmospheric layers of the terminal world, rendered once per
 * marketing page. All are `pointer-events: none` and purely decorative
 * (aria-hidden):
 *   - ledger grid   — a faint 12-column vertical hairline field, behind content
 *   - vignette      — soft radial edge-darkening
 *   - film grain    — a static tiling noise overlay, `mix-blend-mode: overlay`
 *
 * Static only: no animation, so it is identical under prefers-reduced-motion.
 */
export function Atmosphere() {
  return (
    <div aria-hidden="true">
      <div className="mk-ledger-grid" />
      <div className="mk-vignette" />
      <div className="mk-grain" />
    </div>
  );
}
