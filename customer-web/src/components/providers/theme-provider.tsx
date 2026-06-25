"use client";

export {
  ThemeProvider,
  useTheme as useThemeBase,
  useChartTheme,
  themeInitScript,
  type ThemePreference,
  type ResolvedTheme
} from "../../../../shared/theme/react/ThemeProvider";

import { useTheme as useThemeBase } from "../../../../shared/theme/react/ThemeProvider";

/** Backward-compatible hook for existing customer-web components. */
export function useTheme() {
  const ctx = useThemeBase();
  return {
    theme: ctx.resolved,
    resolved: ctx.resolved,
    preference: ctx.preference,
    setTheme: (t: "light" | "dark") => ctx.setPreference(t),
    setPreference: ctx.setPreference,
    toggleTheme: ctx.toggle,
    toggle: ctx.toggle
  };
}
