"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { THEME_STORAGE_KEY, type ThemePreference } from "../constants";
import type { ResolvedTheme } from "../colors";

export type { ThemePreference, ResolvedTheme };

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return getSystemTheme();
  return preference;
}

export function applyTheme(resolved: ResolvedTheme, animate = false) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (animate) {
    root.classList.add("theme-transitioning");
    window.setTimeout(() => root.classList.remove("theme-transitioning"), 300);
  }

  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  root.dataset.theme = resolved;
}

/** Inline script to prevent flash of wrong theme — embed in layout <head>. */
export const themeInitScript = `(function(){try{var k="${THEME_STORAGE_KEY}";var p=localStorage.getItem(k);var r=p==="light"||p==="dark"?p:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var d=document.documentElement;d.classList.toggle("dark",r==="dark");d.style.colorScheme=r;d.dataset.theme=r;}catch(e){}})();`;

export function ThemeProvider({ children, defaultPreference = "system" }: { children: ReactNode; defaultPreference?: ThemePreference }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(defaultPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initial: ThemePreference =
      stored === "light" || stored === "dark" || stored === "system" ? stored : defaultPreference;
    const resolvedInitial = resolveTheme(initial);
    setPreferenceState(initial);
    setResolved(resolvedInitial);
    applyTheme(resolvedInitial);
    setMounted(true);
  }, [defaultPreference]);

  useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (preference === "system") {
        const next = getSystemTheme();
        setResolved(next);
        applyTheme(next, true);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference, mounted]);

  const setPreference = useCallback((next: ThemePreference) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    const resolvedNext = resolveTheme(next);
    setPreferenceState(next);
    setResolved(resolvedNext);
    applyTheme(resolvedNext, true);
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/** Chart colors that adapt to current theme via CSS variables. */
export function useChartTheme() {
  const { resolved } = useTheme();
  return useMemo(
    () => ({
      grid: resolved === "dark" ? "rgba(255,255,255,0.08)" : "#E5E7EB",
      axis: resolved === "dark" ? "#707784" : "#6B7280",
      text: resolved === "dark" ? "#BFC7D5" : "#6B7280",
      tooltip: {
        bg: resolved === "dark" ? "#1E2128" : "#FFFFFF",
        border: resolved === "dark" ? "#343A46" : "#E5E7EB"
      },
      colors: resolved === "dark"
        ? ["#4F8CFF", "#22C55E", "#F59E0B", "#EF4444", "#38BDF8", "#A78BFA"]
        : ["#2563EB", "#16A34A", "#F59E0B", "#DC2626", "#0284C7", "#7C3AED"]
    }),
    [resolved]
  );
}
