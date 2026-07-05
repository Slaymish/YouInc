// Shared YouInc logo. Renders the brand SVG masters from /public/brand so the
// wordmark/icon are used consistently across marketing, auth, and app chrome
// instead of plain text. See /brand/guidelines/logo-usage.md for when to use
// which variant. All current chrome is light-themed, so the ink wordmark is the
// default; pass variant="inverted" for dark surfaces.

// Intrinsic aspect ratios from each SVG's viewBox, used for width/height attrs
// so the browser reserves space (no layout shift) while the SVG loads.
const DIMS = {
  wordmark: { src: "/brand/youinc-wordmark.svg", ratio: 532 / 135 },
  inverted: { src: "/brand/youinc-wordmark-inverted.svg", ratio: 532 / 135 },
  icon: { src: "/brand/youinc-icon.svg", ratio: 1 },
} as const;

interface LogoProps {
  variant?: keyof typeof DIMS;
  /** Rendered height in px (width derives from the aspect ratio). */
  height?: number;
  className?: string;
}

export function Logo({ variant = "wordmark", height = 26, className }: LogoProps) {
  const { src, ratio } = DIMS[variant];
  return (
    <img
      src={src}
      alt="YouInc"
      className={className}
      width={Math.round(height * ratio)}
      height={height}
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
