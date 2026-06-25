/**
 * Staff mobile UI tokens — derived from shared/theme.
 * Use `useThemeColors()` in components for reactive light/dark values.
 */
import { Platform, type TextStyle, type ViewStyle } from "react-native";
import { darkColors, lightColors } from "../../../shared/theme/colors";
import type { StaffRoleId } from "../constants/staff-roles";

/** Default export for static StyleSheet usage (light palette). Prefer useThemeColors() at runtime. */
export const staffColors = {
  bg: lightColors.background,
  surface: lightColors.surface,
  text: lightColors.textPrimary,
  muted: lightColors.textSecondary,
  border: lightColors.border,
  accent: lightColors.primary,
  success: lightColors.success,
  warning: lightColors.warning,
  danger: lightColors.danger,
  info: lightColors.info
};

export { darkColors, lightColors };

export const roleAccent: Record<StaffRoleId, string> = {
  admin: "#7C3AED",
  manager: darkColors.info,
  cashier: darkColors.success,
  kitchen: darkColors.warning,
  waiter: "#DB2777"
};

export const rolePanelTitle: Record<StaffRoleId, string> = {
  admin: "Admin",
  manager: "Manager",
  cashier: "Cashier / POS",
  kitchen: "Kitchen",
  waiter: "Waiter"
};

export function cardShadow(resolved: "light" | "dark" = "light"): ViewStyle {
  const shadowColor = resolved === "dark" ? "#000" : "#0f172a";
  return Platform.select({
    ios: {
      shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: resolved === "dark" ? 0.25 : 0.08,
      shadowRadius: 12
    },
    android: { elevation: resolved === "dark" ? 4 : 3 },
    default: {}
  }) as ViewStyle;
}

export const titleStyle: TextStyle = {
  fontSize: 22,
  fontWeight: "800",
  color: staffColors.text,
  letterSpacing: -0.3
};

export const subtitleStyle: TextStyle = {
  fontSize: 13,
  color: staffColors.muted,
  lineHeight: 18
};
