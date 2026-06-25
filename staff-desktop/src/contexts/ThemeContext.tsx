import { useEffect, useMemo, useState, type ReactNode } from "react";
import { initStaffDb } from "@/lib/staff-db";
import {
  ThemeProvider as SharedThemeProvider,
  useTheme as useSharedTheme
} from "../../../shared/theme/react/ThemeProvider";

export {
  themeInitScript,
  useChartTheme,
  type ThemePreference,
  type ResolvedTheme
} from "../../../shared/theme/react/ThemeProvider";

export type ThemeMode = "light" | "dark";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <SharedThemeProvider defaultPreference="dark">{children}</SharedThemeProvider>;
}

/** Backward-compatible hook — exposes legacy `mode` / `setMode` plus full shared API. */
export function useTheme() {
  const shared = useSharedTheme();
  return useMemo(
    () => ({
      ...shared,
      mode: shared.resolved as ThemeMode,
      setMode: (mode: ThemeMode) => shared.setPreference(mode),
      preference: shared.preference,
      setPreference: shared.setPreference
    }),
    [shared]
  );
}

export function StaffDbProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void initStaffDb()
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : "Firebase init failed"));
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-theme-danger-muted p-8 text-center">
        <div>
          <p className="text-lg font-bold text-theme-danger">Could not connect to cloud</p>
          <p className="mt-2 text-sm text-theme-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-theme-background text-sm text-theme-text-secondary">
        Connecting to cloud…
      </div>
    );
  }

  return <>{children}</>;
}
