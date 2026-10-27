"use client";

import { useEffect } from "react";
import { t, type Locale } from "@/lib/i18n";

const THEME_KEY = "krok-theme";

export function ThemeToggle({ locale }: { locale: Locale }) {
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : systemIsDark ? "dark" : "light";

    if (savedTheme === "dark" || savedTheme === "light") {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }, []);

  function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme
      ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(THEME_KEY, nextTheme);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={t(locale, "theme.toggle")}
      title={t(locale, "theme.toggle")}
    >
      <svg className="theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z" />
      </svg>
      <svg className="theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </svg>
    </button>
  );
}
