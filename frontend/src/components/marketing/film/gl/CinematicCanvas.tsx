import { useEffect, useRef } from "react";
import { useCapabilities } from "~/hooks/useCapabilities";
import {
  measureActRanges,
  computeFilmUniforms,
  type ActRanges,
} from "./sceneManager";
import type { ParticleSceneHandle } from "./particleScene";
import "./cinematic-canvas.css";

// One fixed, full-viewport canvas behind all film content. Single renderer,
// single rAF loop. three.js loads via dynamic import from an idle callback
// after hydration — never in the initial chunk, never blocking the hero.
//
// Degradation ladder (lib/capabilities):
//   static → this component renders nothing; CSS backdrops carry the film
//   lite   → ~8k particles, no pointer parallax
//   full   → ~25k particles + pointer parallax
//
// Perf guard: if the rolling average frame time stays above 22ms, the particle
// count is halved (repeatable). Rendering pauses when the tab is hidden or the
// film is fully scrolled past (intensity 0 outside the close act).

const FRAME_BUDGET_MS = 22;
const FRAME_WINDOW = 60;

function scheduleIdle(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 350);
  return () => window.clearTimeout(id);
}

export function CinematicCanvas() {
  const caps = useCapabilities();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = caps.tier !== "static";

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const root = canvas.closest<HTMLElement>(".mk");
    if (!root) return;

    let disposed = false;
    let sceneHandle: ParticleSceneHandle | null = null;
    let rafId = 0;
    let ranges: ActRanges | null = null;
    let lastTime = 0;
    const frameTimes: number[] = [];
    let frameCursor = 0;
    let degraded = 0;
    const cleanups: Array<() => void> = [];

    const remeasure = () => {
      ranges = measureActRanges(root);
    };

    const loop = (now: number) => {
      if (disposed) return;
      rafId = requestAnimationFrame(loop);
      if (!sceneHandle || document.hidden) return;

      const dt = lastTime === 0 ? 0.016 : Math.min((now - lastTime) / 1000, 0.05);

      if (ranges) {
        const u = computeFilmUniforms(window.scrollY, window.innerHeight, ranges);
        sceneHandle.setUniforms(u);
        // Fully faded and mid-page: skip the draw entirely.
        if (u.intensity <= 0.001) {
          lastTime = now;
          return;
        }
      }

      const start = performance.now();
      sceneHandle.render(dt);
      const cost = performance.now() - start;
      lastTime = now;

      // Rolling perf guard — halve the particle budget (at most twice).
      frameTimes[frameCursor % FRAME_WINDOW] = cost;
      frameCursor += 1;
      if (frameCursor >= FRAME_WINDOW && frameCursor % FRAME_WINDOW === 0 && degraded < 2) {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        if (avg > FRAME_BUDGET_MS) {
          sceneHandle.degrade();
          degraded += 1;
        }
      }
    };

    const cancelIdle = scheduleIdle(() => {
      void (async () => {
        const { createParticleScene } = await import("./particleScene");
        if (disposed) return;

        const styles = getComputedStyle(root);
        const scene = await createParticleScene(canvas, caps.particleCount, {
          dim: styles.getPropertyValue("--mk-accent-dim").trim() || "#12a150",
          bright: styles.getPropertyValue("--mk-accent").trim() || "#34d97b",
        });
        if (disposed) {
          scene.dispose();
          return;
        }
        sceneHandle = scene;

        const onResize = () => {
          scene.resize(window.innerWidth, window.innerHeight);
          remeasure();
        };
        onResize();
        // Re-measure after GSAP pins settle (they change document height).
        const settle1 = window.setTimeout(remeasure, 800);
        const settle2 = window.setTimeout(remeasure, 2500);
        window.addEventListener("resize", onResize);
        cleanups.push(() => {
          window.removeEventListener("resize", onResize);
          window.clearTimeout(settle1);
          window.clearTimeout(settle2);
        });

        if (caps.tier === "full") {
          const onPointer = (event: PointerEvent) => {
            scene.setPointer(
              (event.clientX / window.innerWidth) * 2 - 1,
              -((event.clientY / window.innerHeight) * 2 - 1),
            );
          };
          window.addEventListener("pointermove", onPointer, { passive: true });
          cleanups.push(() => window.removeEventListener("pointermove", onPointer));
        }

        // Crossfade: canvas in, static CSS backdrops out.
        canvas.classList.add("is-live");
        root.dataset.gl = "on";

        rafId = requestAnimationFrame(loop);
      })();
    });

    return () => {
      disposed = true;
      cancelIdle();
      cancelAnimationFrame(rafId);
      for (const cleanup of cleanups) cleanup();
      delete root.dataset.gl;
      sceneHandle?.dispose();
      sceneHandle = null;
    };
  }, [active, caps.particleCount, caps.tier]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="mk-gl-canvas" aria-hidden="true" />;
}
