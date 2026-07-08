// frontend/src/components/dashboard/icons.tsx
//
// Small inline SVG icon set for the dashboard grid's edit-mode controls.
// Inline (not <img> / not a unicode glyph) so `currentColor` resolves against
// the button's CSS color for hover/focus states, and so rendering is identical
// across OS/font stacks — the same pattern MarketingFooter uses for its social
// icon. Zero runtime cost, no new dependency.
//
// Every icon is decorative: the parent <button> already carries the accessible
// name via aria-label, so each svg is aria-hidden.

interface IconProps {
  /** Pixel size (width & height). Defaults to 16. */
  size?: number;
  className?: string;
}

function svgProps(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    className,
  };
}

/** Six-dot drag affordance (replaces the "⠿" glyph). */
export function DragIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} fill="currentColor" stroke="none">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

/** Two-way swap arrows (replaces the "⇄" glyph). */
export function SwapIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M7 10 4 7l3-3" />
      <path d="M4 7h13" />
      <path d="m17 14 3 3-3 3" />
      <path d="M20 17H7" />
    </svg>
  );
}

/** Close / remove cross (replaces the "×" glyph). */
export function RemoveIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

/** Plus (replaces the "+" glyph on the add-view tab and add-widget button). */
export function AddIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
