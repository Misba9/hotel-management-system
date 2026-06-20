import { Platform, type TextStyle, type ViewStyle } from "react-native";

export const loginColors = {
  bg: "#0A0A0F",
  bgAccent: "#12121A",
  card: "rgba(18,18,26,0.72)",
  cardBorder: "rgba(255,255,255,0.1)",
  primary: "#FF7A00",
  primaryDark: "#E56A00",
  primaryGlow: "rgba(255,122,0,0.35)",
  text: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textDim: "#71717A",
  inputBg: "rgba(255,255,255,0.04)",
  inputBorder: "rgba(255,255,255,0.12)",
  inputFocus: "rgba(255,122,0,0.5)",
  error: "#EF4444",
  errorMuted: "rgba(239,68,68,0.12)",
  success: "#22C55E"
} as const;

export const loginFont = Platform.select({
  web: { fontFamily: "Inter, Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  default: {}
}) as TextStyle;

export const loginRadius = { card: 24, input: 14, button: 14 } as const;

export function loginCardShadow(): ViewStyle {
  if (Platform.OS === "web") {
    return {
      boxShadow:
        "0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)"
    } as ViewStyle;
  }
  return Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.45,
      shadowRadius: 32
    },
    android: { elevation: 12 },
    default: {}
  }) as ViewStyle;
}

export function loginButtonGradient(): ViewStyle {
  if (Platform.OS === "web") {
    return {
      backgroundColor: loginColors.primary,
      backgroundImage: "linear-gradient(135deg, #FF8C1A 0%, #FF6A00 50%, #E85D00 100%)"
    } as ViewStyle;
  }
  return { backgroundColor: loginColors.primary };
}
