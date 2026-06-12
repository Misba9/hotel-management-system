import { Platform, type TextStyle, type ViewStyle } from "react-native";

/** Enterprise POS design tokens — Toast / Square inspired */
export const posColors = {
  bg: "#0A0A0F",
  secondary: "#12121A",
  card: "#1A1A24",
  cardHover: "#22222E",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  primary: "#FF7A00",
  primaryMuted: "rgba(255,122,0,0.14)",
  success: "#22C55E",
  successMuted: "rgba(34,197,94,0.14)",
  warning: "#F59E0B",
  warningMuted: "rgba(245,158,11,0.14)",
  danger: "#EF4444",
  dangerMuted: "rgba(239,68,68,0.14)",
  text: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textDim: "#71717A",
  dineIn: "#22C55E",
  parcel: "#FF7A00",
  online: "#38BDF8",
  glow: "rgba(255,122,0,0.35)",
  glass: "rgba(18,18,26,0.85)"
};

export const posSpacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;

export const posRadius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const posFont = Platform.select({
  web: { fontFamily: "Inter, Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  default: {}
}) as TextStyle;

export const posType = {
  hero: { ...posFont, fontSize: 28, fontWeight: "800" as const, color: posColors.text, letterSpacing: -0.5 },
  h1: { ...posFont, fontSize: 22, fontWeight: "800" as const, color: posColors.text, letterSpacing: -0.3 },
  h2: { ...posFont, fontSize: 18, fontWeight: "700" as const, color: posColors.text },
  h3: { ...posFont, fontSize: 15, fontWeight: "700" as const, color: posColors.text },
  body: { ...posFont, fontSize: 14, fontWeight: "500" as const, color: posColors.text },
  small: { ...posFont, fontSize: 12, fontWeight: "500" as const, color: posColors.textSecondary },
  label: {
    ...posFont,
    fontSize: 10,
    fontWeight: "700" as const,
    color: posColors.textDim,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const
  },
  metric: { ...posFont, fontSize: 20, fontWeight: "800" as const, color: posColors.text, letterSpacing: -0.5 }
};

export function posShadow(elevated = false): ViewStyle {
  if (Platform.OS === "web") {
    return {
      boxShadow: elevated
        ? "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)"
    } as ViewStyle;
  }
  return Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: elevated ? 8 : 4 },
      shadowOpacity: elevated ? 0.35 : 0.2,
      shadowRadius: elevated ? 16 : 8
    },
    android: { elevation: elevated ? 8 : 3 },
    default: {}
  }) as ViewStyle;
}

export const posTransition = Platform.OS === "web" ? ({ transition: "all 300ms ease" } as ViewStyle) : {};

export function posPanel(): ViewStyle {
  return {
    flex: 1,
    backgroundColor: posColors.secondary,
    borderColor: posColors.border,
    overflow: "hidden"
  };
}

export function posCard(elevated = false): ViewStyle {
  return {
    backgroundColor: posColors.card,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.border,
    ...posShadow(elevated)
  };
}
