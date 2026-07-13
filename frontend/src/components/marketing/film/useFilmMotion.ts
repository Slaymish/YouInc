import { useEffect, type RefObject } from "react";
import { detectCapabilities } from "~/lib/capabilities";
import { loadMotion, type MotionStack } from "~/lib/motion";
import { formatMoney } from "../../widgets/format";

// Scroll-film choreography for the landing acts. Everything here is motion
// sugar layered over the Phase-1 static composition:
//   - prefers-reduced-motion / static tier → this hook does nothing at all
//   - the DOM is never restructured; GSAP only animates transform/opacity
//     (plus SVG dash draw), and `data-motion="gsap"` CSS overrides neutralize
//     the IO fallback animations so the two systems never fight.
// gsap, ScrollTrigger, and lenis are all dynamically imported after mount.

type LenisInstance = InstanceType<typeof import("lenis").default>;

const COUNT_DURATION = 1.4;

function buildHeroEntrance({ gsap }: MotionStack) {
  const tl = gsap.timeline({
    defaults: { ease: "power3.out", duration: 0.7 },
  });
  tl.from(".act-hero__eyebrow", { autoAlpha: 0, y: 12, duration: 0.45 })
    .from(
      ".act-hero__line-inner",
      { yPercent: 112, duration: 0.85, stagger: 0.09, ease: "expo.out" },
      "-=0.2",
    )
    .from(".act-hero__sub", { autoAlpha: 0, y: 14 }, "-=0.45")
    .from(".act-hero__ctas", { autoAlpha: 0, y: 12 }, "-=0.5")
    .from(".act-hero__reassurance", { autoAlpha: 0, duration: 0.4 }, "-=0.4")
    .from(".act-hero__cue", { autoAlpha: 0, duration: 0.4 }, "-=0.2");
  return tl;
}

/** Act II — pin the engine and scrub through the three beats while the ledger
 * writes itself two rows (one balanced pair) per beat. */
function buildEngineScrub({ gsap }: MotionStack) {
  const beats = gsap.utils.toArray<HTMLElement>(".act-engine__beat");
  const rows = gsap.utils.toArray<HTMLElement>(".act-engine__row");
  const foot = ".act-engine__ledger-foot";
  if (beats.length === 0 || rows.length === 0) return;

  gsap.set(beats.slice(1), { opacity: 0.22, y: 18 });
  gsap.set(rows, { autoAlpha: 0, x: -10 });
  gsap.set(foot, { autoAlpha: 0 });

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".act-engine",
      start: "top top",
      end: "+=220%",
      pin: true,
      scrub: 0.6,
      anticipatePin: 1,
    },
  });

  const perBeat = Math.ceil(rows.length / beats.length);
  beats.forEach((beat, i) => {
    const chunk = rows.slice(i * perBeat, (i + 1) * perBeat);
    if (i > 0) {
      tl.to(beats[i - 1], { opacity: 0.22, duration: 0.3 }, `beat${i}`);
      tl.to(beat, { opacity: 1, y: 0, duration: 0.4 }, `beat${i}`);
    }
    tl.to(
      chunk,
      { autoAlpha: 1, x: 0, duration: 0.35, stagger: 0.18 },
      i === 0 ? 0.1 : `beat${i}+=0.2`,
    );
    tl.to({}, { duration: 0.5 }); // hold
  });
  tl.to(foot, { autoAlpha: 1, duration: 0.4 }, "-=0.3");
}

/** Count a mono figure up from zero once, honoring the element's format. */
function countUp(stack: MotionStack, el: HTMLElement) {
  const { gsap } = stack;
  const raw = Number(el.dataset.countup);
  if (!Number.isFinite(raw)) return;
  const unit = el.dataset.unit;
  const state = { v: 0 };
  gsap.to(state, {
    v: raw,
    duration: COUNT_DURATION,
    ease: "power2.out",
    onUpdate: () => {
      el.textContent = unit
        ? `${Math.round(state.v)} ${unit}`
        : formatMoney(Math.round(state.v));
    },
  });
}

/** Act III — the deck assembles: tiles rise in sequence, the trend line draws
 * itself, cashflow bars grow, balance fills sweep. Count-ups fire once when
 * the deck enters. */
function buildCommandAssembly(stack: MotionStack) {
  const { gsap, ScrollTrigger } = stack;
  const tiles = gsap.utils.toArray<HTMLElement>(".cd__tile");
  if (tiles.length === 0) return;

  gsap.set(tiles, { autoAlpha: 0, y: 26 });
  gsap.set(".cd-bars__bar", { scaleY: 0, transformOrigin: "bottom center" });
  gsap.set(".cd-balance__fill", { scaleX: 0, transformOrigin: "left center" });

  const trendLine = document.querySelector<SVGPathElement>(".cd-trend__line");
  let trendLen = 0;
  if (trendLine) {
    trendLen = trendLine.getTotalLength();
    gsap.set(trendLine, { strokeDasharray: trendLen, strokeDashoffset: trendLen });
    gsap.set(".cd-trend__area, .cd-trend__dot", { autoAlpha: 0 });
  }

  const tl = gsap.timeline({
    defaults: { ease: "power3.out" },
    scrollTrigger: {
      trigger: ".act-command__deck",
      start: "top 72%",
      once: true,
      onEnter: () => {
        document
          .querySelectorAll<HTMLElement>("[data-countup]")
          .forEach((el) => countUp(stack, el));
      },
    },
  });

  tl.to(tiles, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12 });
  if (trendLine) {
    tl.to(trendLine, { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" }, "-=0.6");
    tl.to(".cd-trend__area, .cd-trend__dot", { autoAlpha: 1, duration: 0.4 }, "-=0.3");
  }
  tl.to(".cd-bars__bar", { scaleY: 1, duration: 0.5, stagger: 0.03 }, "-=0.8");
  tl.to(".cd-balance__fill", { scaleX: 1, duration: 0.6, stagger: 0.06 }, "-=0.5");

  // Slow parallax drift while the deck stays in view.
  gsap.to(".act-command__deck", {
    yPercent: -2,
    ease: "none",
    scrollTrigger: {
      trigger: ".act-command__deck",
      start: "top bottom",
      end: "bottom top",
      scrub: 1.2,
    },
  });

  return ScrollTrigger;
}

/** Act VII — a quiet rise for the closing statement. */
function buildCloseReveal({ gsap }: MotionStack) {
  gsap.from(".act-close__content > *", {
    autoAlpha: 0,
    y: 22,
    duration: 0.8,
    ease: "power3.out",
    stagger: 0.1,
    scrollTrigger: { trigger: ".act-close", start: "top 70%", once: true },
  });
}

export function useFilmMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const caps = detectCapabilities();
    if (caps.reducedMotion || caps.tier === "static") return;
    const root = rootRef.current;
    if (!root) return;

    let disposed = false;
    let lenis: LenisInstance | null = null;
    let ctx: gsap.Context | null = null;
    let tickerFn: ((time: number) => void) | null = null;
    let stackRef: MotionStack | null = null;

    void (async () => {
      const [stack, lenisModule] = await Promise.all([
        loadMotion(),
        import("lenis"),
      ]);
      if (disposed) return;
      stackRef = stack;
      const { gsap, ScrollTrigger } = stack;

      // Smooth scroll — driven from gsap's ticker so there is ONE rAF loop.
      lenis = new lenisModule.default({ lerp: 0.12 });
      lenis.on("scroll", ScrollTrigger.update);
      tickerFn = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(tickerFn);
      gsap.ticker.lagSmoothing(0);

      // Flag the root so CSS neutralizes the IO fallback animations.
      root.dataset.motion = "gsap";

      ctx = gsap.context(() => {
        buildHeroEntrance(stack);
        buildEngineScrub(stack);
        buildCommandAssembly(stack);
        buildCloseReveal(stack);
      }, root);

      ScrollTrigger.refresh();
    })();

    return () => {
      disposed = true;
      delete root.dataset.motion;
      ctx?.revert();
      if (stackRef && tickerFn) stackRef.gsap.ticker.remove(tickerFn);
      lenis?.destroy();
    };
  }, [rootRef]);
}
