import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, type ColorSchemeName } from "react-native";
import { darkColors, lightColors, type ResolvedTheme, type ThemeColorPalette } from "../colors";
import { THEME_STORAGE_KEY, type ThemePreference } from "../constants";

export type { ThemePreference, ResolvedTheme, ThemeColorPalette };

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  colors: ThemeColorPalette;
  setPreference: (preference: ThemePreference) => Promise<void>;
  toggle: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(preference: ThemePreference, systemScheme: ColorSchemeName): ResolvedTheme {
  if (preference === "system") {
    return systemScheme === "dark" ? "dark" : "light";
  }
  return preference;
}

export function MobileThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreferenceState(stored);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const resolved = resolveTheme(preference, systemScheme);
  const colors = resolved === "dark" ? darkColors : lightColors;

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(async () => {
    const next: ThemePreference = resolved === "dark" ? "light" : "dark";
    await setPreference(next);
  }, [resolved, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, colors, setPreference, toggle }),
    [preference, resolved, colors, setPreference, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useMobileTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useMobileTheme must be used within MobileThemeProvider");
  return ctx;
}

export function useThemeColors(): ThemeColorPalette {
  return useMobileTheme().colors;
}
