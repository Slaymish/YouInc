// Capability detection for the cinematic marketing surface. One module, read
// once on the client, drives the degradation ladder in §5 of the redesign plan:
//   tier "full"    — WebGL particle film, GSAP scrub, Lenis smooth scroll
//   tier "lite"    — reduced particle count, no pointer interaction (mobile)
//   tier "static"  — no WebGL / no motion: pre-composed CSS/SVG backdrops
//
// Server-safe: every reader guards `typeof window`. Never throws.

export type MotionTier = "full" | "lite" | "static";

export interface Capabilities {
  readonly tier: MotionTier;
  readonly reducedMotion: boolean;
  readonly webgl: boolean;
  readonly coarsePointer: boolean;
  readonly lowMemory: boolean;
  readonly smallViewport: boolean;
  /** Suggested particle budget for the GL scenes at this tier. */
  readonly particleCount: number;
}

const FULL_PARTICLES = 25_000;
const LITE_PARTICLES = 8_000;
const SMALL_VIEWPORT_PX = 760;

function detectReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function detectWebgl(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

function detectCoarsePointer(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

function detectLowMemory(): boolean {
  if (typeof navigator === "undefined") return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof mem === "number" && mem < 4;
}

/** The static fallback capability set — used during SSR and as a safe default. */
export const STATIC_CAPABILITIES: Capabilities = {
  tier: "static",
  reducedMotion: true,
  webgl: false,
  coarsePointer: false,
  lowMemory: false,
  smallViewport: false,
  particleCount: 0,
};

export function detectCapabilities(): Capabilities {
  if (typeof window === "undefined") return STATIC_CAPABILITIES;

  const reducedMotion = detectReducedMotion();
  const webgl = detectWebgl();
  const coarsePointer = detectCoarsePointer();
  const lowMemory = detectLowMemory();
  const smallViewport = window.innerWidth < SMALL_VIEWPORT_PX;

  let tier: MotionTier;
  if (reducedMotion || !webgl || lowMemory) {
    tier = "static";
  } else if (coarsePointer || smallViewport) {
    tier = "lite";
  } else {
    tier = "full";
  }

  const particleCount =
    tier === "full" ? FULL_PARTICLES : tier === "lite" ? LITE_PARTICLES : 0;

  return {
    tier,
    reducedMotion,
    webgl,
    coarsePointer,
    lowMemory,
    smallViewport,
    particleCount,
  };
}
