/**
 * Shared spacing, radii, and elevation for production UI consistency.
 */
import { Platform, type ViewStyle } from "react-native";

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  full: 9999
} as const;

export function elevation(level: 1 | 2 | 3 | 4): ViewStyle {
  const map = {
    1: { shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    2: { shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
    3: { shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
    4: { shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 }
  }[level];
  return Platform.select({
    ios: {
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: map.shadowOpacity,
      shadowRadius: map.shadowRadius
    },
    android: { elevation: map.elevation },
    default: {}
  }) as ViewStyle;
}
