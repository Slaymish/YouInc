// Pure scroll → film-uniform mapping for the particle scenes. Measures the act
// elements once (re-measured on resize / layout settle) and converts a scroll
// position into the morph/intensity/focus uniforms the shader consumes:
//
//   uMorph1  chaos → balanced debit/credit streams   (through Act II, 1st half)
//   uMorph2  streams → ordered lattice               (Act II 2nd half → Act III)
//   intensity  canvas presence per act (hero bright, engine mid, fades out
//              after command, returns for the close)
//   focus    close-act center condensation
//
// Kept free of three.js/GSAP so it is unit-testable and cheap to call per frame.

export interface ActRanges {
  readonly heroTop: number;
  readonly heroBottom: number;
  readonly engineTop: number;
  readonly engineBottom: number;
  readonly commandTop: number;
  readonly commandBottom: number;
  readonly closeTop: number;
  readonly closeBottom: number;
}

export interface FilmUniforms {
  readonly morph1: number;
  readonly morph2: number;
  readonly intensity: number;
  readonly focus: number;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Linear progress of `y` through [a, b]. */
function progress(y: number, a: number, b: number): number {
  if (b <= a) return y >= b ? 1 : 0;
  return clamp01((y - a) / (b - a));
}

export function measureActRanges(root: ParentNode): ActRanges | null {
  const q = (sel: string) => root.querySelector<HTMLElement>(sel);
  const hero = q(".act-hero");
  const engine = q(".act-engine");
  const command = q(".act-command");
  const close = q(".act-close");
  if (!hero || !engine || !command || !close) return null;

  const top = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;
  const bottom = (el: HTMLElement) => top(el) + el.offsetHeight;

  // When Act II is pinned, GSAP wraps it in a .pin-spacer — measure the spacer
  // so the morph spans the full scrubbed distance.
  const engineSpan = (engine.parentElement?.classList.contains("pin-spacer")
    ? engine.parentElement
    : engine) as HTMLElement;

  return {
    heroTop: top(hero),
    heroBottom: bottom(hero),
    engineTop: top(engineSpan),
    engineBottom: bottom(engineSpan),
    commandTop: top(command),
    commandBottom: bottom(command),
    closeTop: top(close),
    closeBottom: bottom(close),
  };
}

export function computeFilmUniforms(
  scrollY: number,
  viewportH: number,
  r: ActRanges,
): FilmUniforms {
  const mid = scrollY + viewportH / 2;

  // Morphs sweep across the engine span: first half orders chaos into streams,
  // second half locks streams into the lattice.
  const engineMid = (r.engineTop + r.engineBottom) / 2;
  const morph1 = progress(mid, r.engineTop, engineMid);
  const morph2 = progress(mid, engineMid, r.engineBottom);

  // Bring the particle field back for the closing act without condensing it.
  const closeIn = progress(mid, r.closeTop - viewportH * 0.5, r.closeTop + viewportH * 0.3);

  // Intensity: hero 1 → engine 0.8 → command 0.45 → 0 after command → close 1.
  const heroOut = 1 - progress(mid, r.heroBottom, r.engineTop) * 0.2;
  const commandDim = 1 - progress(mid, r.commandTop, (r.commandTop + r.commandBottom) / 2) * 0.45;
  const fadeOut = 1 - progress(mid, r.commandBottom - viewportH * 0.4, r.commandBottom + viewportH * 0.4);
  const base = Math.min(heroOut, commandDim) * fadeOut;
  const intensity = clamp01(Math.max(base, closeIn));

  return { morph1, morph2, intensity, focus: 0 };
}
