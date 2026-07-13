import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import "./primitives.css";

/* ── Eyebrow — the film's chapter markers ────────────────────────────────
 * Mono, uppercase, faint, with a leading index like `01 / CHAOS`. Used as the
 * section opener everywhere. `index` is the two-digit chapter number; `label`
 * the caption. Rendered as a <p> by default so it never competes with the
 * semantic heading beneath it. */
interface EyebrowProps {
  index?: string;
  label: string;
  className?: string;
  as?: "p" | "span" | "div";
}

export function Eyebrow({ index, label, className, as = "p" }: EyebrowProps) {
  const Tag = as;
  return (
    <Tag className={`mk-eyebrow${className ? ` ${className}` : ""}`}>
      {index ? (
        <>
          <span className="mk-eyebrow__index">{index}</span>
          <span className="mk-eyebrow__sep" aria-hidden="true">
            /
          </span>
        </>
      ) : null}
      <span className="mk-eyebrow__label">{label}</span>
    </Tag>
  );
}

/* ── MonoLabel — inline mono meta (timestamps, spec plates, status) ─────── */
interface MonoLabelProps {
  children: ReactNode;
  className?: string;
  tone?: "default" | "accent" | "faint";
}

export function MonoLabel({
  children,
  className,
  tone = "default",
}: MonoLabelProps) {
  return (
    <span className={`mk-mono mk-mono--${tone}${className ? ` ${className}` : ""}`}>
      {children}
    </span>
  );
}

/* ── Button — designed hover/focus/active. Renders a router Link (internal),
 * a plain anchor (external / hash), or a native button. Accent fill wipe on
 * primary; hairline + underline sweep on ghost. ──────────────────────────── */
type ButtonVariant = "primary" | "ghost";

interface BaseButtonProps {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}

interface LinkButtonProps extends BaseButtonProps {
  to: string;
  href?: never;
}

interface AnchorButtonProps
  extends BaseButtonProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> {
  href: string;
  to?: never;
}

function classes(variant: ButtonVariant, className?: string): string {
  return `mk-btn mk-btn--${variant}${className ? ` ${className}` : ""}`;
}

export function ButtonLink({
  variant = "primary",
  children,
  className,
  to,
}: LinkButtonProps) {
  return (
    <Link className={classes(variant, className)} to={to}>
      <span className="mk-btn__label">{children}</span>
    </Link>
  );
}

export function ButtonAnchor({
  variant = "primary",
  children,
  className,
  href,
  ...rest
}: AnchorButtonProps) {
  return (
    <a className={classes(variant, className)} href={href} {...rest}>
      <span className="mk-btn__label">{children}</span>
    </a>
  );
}

/* ── SectionShell — semantic <section> with max-width, gutter, and an optional
 * chapter eyebrow. Keeps the ledger-grid backdrop consistent per act. ─────── */
interface SectionShellProps {
  id?: string;
  labelledBy: string;
  eyebrow?: { index?: string; label: string };
  children: ReactNode;
  className?: string;
  /** Full-bleed sections (film acts) opt out of the measured container. */
  bleed?: boolean;
}

export function SectionShell({
  id,
  labelledBy,
  eyebrow,
  children,
  className,
  bleed = false,
}: SectionShellProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`mk-section${bleed ? " mk-section--bleed" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <div className={bleed ? "mk-section__bleed" : "mk-section__inner"}>
        {eyebrow ? <Eyebrow index={eyebrow.index} label={eyebrow.label} /> : null}
        {children}
      </div>
    </section>
  );
}
