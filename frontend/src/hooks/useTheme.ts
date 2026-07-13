import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "youinc-theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      return;
    }
    // Dark is home for the terminal system; light remains a persisted toggle.
    setTheme("dark");
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return [theme ?? "dark", setTheme] as const;
}
