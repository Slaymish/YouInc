import { useEffect, useRef, useState } from "react";

/**
 * Lightweight enter-reveal via IntersectionObserver. Adds `is-in` to the target
 * once it scrolls into view (one-shot). No motion library, compositor-friendly,
 * and the CSS reveal is neutralized under prefers-reduced-motion so the element
 * simply starts visible. Elements are also revealed immediately if IO is
 * unavailable (SSR-safe / very old browsers) so content never hides.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  threshold?: number;
  rootMargin?: string;
}) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      {
        threshold: options?.threshold ?? 0.15,
        rootMargin: options?.rootMargin ?? "0px 0px -10% 0px",
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [options?.threshold, options?.rootMargin]);

  return { ref, shown };
}
