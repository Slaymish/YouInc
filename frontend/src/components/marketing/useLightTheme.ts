import { useEffect } from "react";

/** Forces light theme while mounted so widget tokens stay consistent on public pages. */
export function useLightTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute("data-theme");
    html.setAttribute("data-theme", "light");
    return () => {
      if (prev) html.setAttribute("data-theme", prev);
      else html.removeAttribute("data-theme");
    };
  }, []);
}
