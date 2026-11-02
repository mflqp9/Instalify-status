"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

// The choice is kept in a cookie, not localStorage: this site stores nothing
// in browser storage. The inline script in layout.tsx applies it before paint.
const COOKIE = "theme";
const YEAR = 60 * 60 * 24 * 365;

function effectiveTheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    setTheme(effectiveTheme());
  }, []);

  const toggle = () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${next}; Path=/; Max-Age=${YEAR}; SameSite=Lax${secure}`;
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-white/5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
