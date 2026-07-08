import { useEffect, useState } from "react";

/**
 * Track which of a set of in-page sections is currently the "active" one, for
 * highlighting an anchor sub-nav. Observes each `#id` element and reports the
 * top-most one intersecting the viewport.
 *
 * SSR-safe: the effect (and IntersectionObserver access) only runs in the
 * browser. Returns the first id until the user scrolls.
 */
export function useScrollSpy(
  ids: string[],
  options?: { rootMargin?: string },
): string {
  const [activeId, setActiveId] = useState(ids[0] ?? "");
  const key = ids.join("|");
  const rootMargin = options?.rootMargin ?? "0px 0px -70% 0px";

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (sections.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Report the earliest section (in document order) still in view.
        const firstVisible = ids.find((id) => visible.has(id));
        if (firstVisible) setActiveId(firstVisible);
      },
      { rootMargin, threshold: 0 },
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rootMargin]);

  return activeId;
}
