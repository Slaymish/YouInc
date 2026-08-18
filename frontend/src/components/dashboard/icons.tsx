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

// ── App-shell navigation icons ────────────────────────────────────────────
// Same inline-SVG rationale as above. These sit beside a text label in the
// side nav and the mobile tab bar, so they are decorative — the link's own
// text is the accessible name.

/** Home — "am I OK?" */
export function HomeIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.8V20h12V9.8" />
    </svg>
  );
}

/** Spending — "where is it going?" */
export function SpendingIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M4 7l6 6 3-3 7 7" />
      <path d="M20 12v5h-5" />
    </svg>
  );
}

/** Net worth — "am I getting richer?" */
export function NetWorthIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M4 17l6-6 3 3 7-7" />
      <path d="M20 12V7h-5" />
    </svg>
  );
}

/** Activity — "what happened?" */
export function ActivityIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
    </svg>
  );
}

/** Accounts — where the money sits. */
export function AccountsIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M16 14h2" />
    </svg>
  );
}

/** Pinboard — whatever you want to watch. */
export function PinboardIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="4" rx="1.5" />
      <rect x="13" y="10" width="7" height="10" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

/** Settings — sliders rather than a gear; legible at 20px. */
export function SettingsIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M4 7h5M13 7h7" />
      <circle cx="11" cy="7" r="2" />
      <path d="M4 17h11M19 17h1" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

/** Workshop — the ledger's machinery, opt-in and slightly technical. */
export function WorkshopIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="16.5" cy="7.5" r="3.5" />
      <path d="M14 10 5 19l1.5 1.5L15.5 11.5" />
    </svg>
  );
}

/** Account / you — the menu that holds Settings, Workshop and sign out. */
export function PersonIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.3-3.5 4-5.2 7-5.2s5.7 1.7 7 5.2" />
    </svg>
  );
}
