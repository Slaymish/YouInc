// Lazy, cached loader for the motion stack. gsap + ScrollTrigger are only ever
// pulled in via dynamic import from client effects (never in the initial
// chunk), and only once per session.

export interface MotionStack {
  readonly gsap: typeof import("gsap").gsap;
  readonly ScrollTrigger: typeof import("gsap/ScrollTrigger").ScrollTrigger;
}

let motionPromise: Promise<MotionStack> | null = null;

export function loadMotion(): Promise<MotionStack> {
  if (!motionPromise) {
    motionPromise = Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
    ]).then(([gsapModule, stModule]) => {
      const { gsap } = gsapModule;
      const { ScrollTrigger } = stModule;
      gsap.registerPlugin(ScrollTrigger);
      return { gsap, ScrollTrigger };
    });
  }
  return motionPromise;
}
