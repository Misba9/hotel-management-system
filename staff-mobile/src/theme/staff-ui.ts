import { Platform, type TextStyle, type ViewStyle } from "react-native";
import type { StaffRoleId } from "../constants/staff-roles";

export const staffColors = {
  bg: "#FFF8F3",
  surface: "#FFFFFF",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  accent: "#FF6B35",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",
  info: "#0EA5E9"
};

export const roleAccent: Record<StaffRoleId, string> = {
  admin: "#7C3AED",
  manager: "#0EA5E9",
  cashier: "#16A34A",
  kitchen: "#EA580C",
  delivery: "#2563EB",
  waiter: "#DB2777"
};

export const rolePanelTitle: Record<StaffRoleId, string> = {
  admin: "Admin",
  manager: "Manager",
  cashier: "Cashier / POS",
  kitchen: "Kitchen",
  delivery: "Delivery",
  waiter: "Waiter"
};

export function cardShadow(): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12
    },
    android: { elevation: 3 },
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
