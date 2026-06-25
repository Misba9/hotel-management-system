"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "./ThemeProvider";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor }
];

type ThemeSwitcherProps = {
  variant?: "segmented" | "compact" | "dropdown";
  className?: string;
};

export function ThemeSwitcher({ variant = "segmented", className = "" }: ThemeSwitcherProps) {
  const { preference, setPreference, toggle, resolved } = useTheme();

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={toggle}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-theme-border bg-theme-hover text-theme-text-secondary transition hover:text-theme-primary ${className}`}
        aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
      >
        {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <div
      className={`inline-flex rounded-xl border border-theme-border bg-theme-surface p-1 ${className}`}
      role="radiogroup"
      aria-label="Theme preference"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-theme-primary text-white shadow-glow-sm"
                : "text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text-primary"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {variant === "segmented" ? label : null}
          </button>
        );
      })}
    </div>
  );
}
