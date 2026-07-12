import { Platform, type TextStyle, type ViewStyle } from "react-native";

import { BREAKPOINTS, getLoginFormMaxWidth, responsivePadding } from "../../src/lib/responsive";

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
        overflowWrap: "break-word"
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

/** Tablet+ two-column layout (brand left, form right) */
export const TABLET_BREAKPOINT = BREAKPOINTS.tablet;

export function loginGridLayout(width: number, isTabletLayout: boolean): ViewStyle {
  if (!isTabletLayout) {
    return { width: "100%", flex: 1 };
  }

  const gap = width >= BREAKPOINTS.largeTablet ? 64 : 48;
  const formWidth = getLoginFormMaxWidth(width);

  if (Platform.OS === "web") {
    return {
      display: "grid",
      width: "100%",
      flex: 1,
      gridTemplateColumns: `minmax(0, 1fr) minmax(280px, ${formWidth}px)`,
      gap,
      alignItems: "center"
    } as unknown as ViewStyle;
  }

  return {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    flex: 1,
    gap
  };
}

export function loginHorizontalPadding(width: number): number {
  return responsivePadding(width);
}
