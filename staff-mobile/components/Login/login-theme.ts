import { Platform, type TextStyle, type ViewStyle } from "react-native";

export const loginColors = {
  bg: "#0B1020",
  bgAccent: "rgba(255,255,255,0.04)",
  card: "rgba(15, 20, 35, 0.72)",
  cardBorder: "rgba(255,255,255,0.1)",
  primary: "#FF7A00",
  primaryDark: "#E56A00",
  primaryGlow: "rgba(255,122,0,0.28)",
  text: "#FFFFFF",
  textSecondary: "#94A3B8",
  textDim: "#64748B",
  inputBg: "rgba(255,255,255,0.05)",
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

export const loginRadius = { card: 20, input: 12, button: 12 } as const;

/** Prevents RN Web from collapsing text into one-character-per-line columns. */
export const loginWebText: TextStyle =
  Platform.OS === "web"
    ? ({
        whiteSpace: "normal",
        wordBreak: "normal",
        overflowWrap: "break-word",
        maxWidth: "100%"
      } as TextStyle)
    : {};

export function loginCardShadow(): ViewStyle {
  if (Platform.OS === "web") {
    return {
      boxShadow:
        "0 24px 48px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)"
    } as ViewStyle;
  }
  return Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.4,
      shadowRadius: 24
    },
    android: { elevation: 10 },
    default: {}
  }) as ViewStyle;
}

export function loginButtonGradient(): ViewStyle {
  if (Platform.OS === "web") {
    return {
      backgroundColor: loginColors.primary,
      backgroundImage: "linear-gradient(135deg, #FF8C1A 0%, #FF7A00 50%, #E56A00 100%)"
    } as ViewStyle;
  }
  return { backgroundColor: loginColors.primary };
}

export const DESKTOP_BREAKPOINT = 992;

export function loginGridLayout(isDesktop: boolean): ViewStyle {
  if (Platform.OS !== "web") {
    return isDesktop
      ? { flexDirection: "row", alignItems: "center", gap: 48, width: "100%" }
      : { width: "100%" };
  }
  return isDesktop
    ? ({
        display: "grid",
        width: "100%",
        gridTemplateColumns: "1fr 420px",
        gap: 48,
        alignItems: "center"
      } as unknown as ViewStyle)
    : ({ width: "100%" } as ViewStyle);
}
