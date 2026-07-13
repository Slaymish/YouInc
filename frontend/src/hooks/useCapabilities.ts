import { useEffect, useState } from "react";
import {
  detectCapabilities,
  STATIC_CAPABILITIES,
  type Capabilities,
} from "~/lib/capabilities";

/**
 * Resolves runtime capabilities on the client after mount. Returns the safe
 * static tier during SSR and the first client render (so markup is stable and
 * hydration never mismatches), then upgrades once the real environment is known.
 */
export function useCapabilities(): Capabilities {
  const [caps, setCaps] = useState<Capabilities>(STATIC_CAPABILITIES);

  useEffect(() => {
    setCaps(detectCapabilities());

    if (!window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setCaps(detectCapabilities());
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return caps;
}
