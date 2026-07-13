import { useEffect } from "react";

/**
 * Forces dark theme while mounted. The Incorporation marketing world is dark by
 * default, and the embedded real widgets (demo, command deck) read the app's
 * `data-theme` tokens — so pinning `dark` keeps marketing and product one world.
 * Restores the previous value on unmount (e.g. navigating into a light app view).
 */
export function useDarkTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute("data-theme");
    html.setAttribute("data-theme", "dark");
    return () => {
      if (prev) html.setAttribute("data-theme", prev);
      else html.removeAttribute("data-theme");
    };
  }, []);
}
