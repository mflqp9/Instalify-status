import type { Config } from "tailwindcss";

// Every colour is a CSS variable (src/app/globals.css), so light and dark mode
// are one set of tokens swapped on :root rather than a dark: variant per class.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1180px" } },
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        brand: "rgb(var(--brand) / <alpha-value>)",
        ok: "rgb(var(--ok) / <alpha-value>)",
        info: "rgb(var(--info) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        partial: "rgb(var(--partial) / <alpha-value>)",
        bad: "rgb(var(--bad) / <alpha-value>)",
        unknown: "rgb(var(--unknown) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.14)",
        lift: "0 2px 4px rgb(15 23 42 / 0.06), 0 24px 48px -16px rgb(15 23 42 / 0.28)",
      },
      keyframes: {
        ping2: {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "80%, 100%": { transform: "scale(2.4)", opacity: "0" },
        },
        fadeup: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        ping2: "ping2 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        fadeup: "fadeup 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
