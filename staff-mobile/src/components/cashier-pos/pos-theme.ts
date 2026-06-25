import { Platform, type TextStyle, type ViewStyle } from "react-native";
import { darkColors, lightColors } from "../../../../shared/theme/colors";
import { radius } from "../../../../shared/theme/radius";
import { spacing } from "../../../../shared/theme/spacing";

/** Enterprise POS design tokens — sourced from shared/theme dark palette */
export const posColors = {
  bg: darkColors.background,
  secondary: darkColors.surface,
  card: darkColors.card,
  cardHover: darkColors.hover,
  border: darkColors.divider,
  borderStrong: darkColors.border,
  primary: darkColors.primary,
  primaryMuted: darkColors.primaryMuted,
  success: darkColors.success,
  successMuted: darkColors.successMuted,
  warning: darkColors.warning,
  warningMuted: darkColors.warningMuted,
  danger: darkColors.danger,
  dangerMuted: darkColors.dangerMuted,
  text: darkColors.textPrimary,
  textSecondary: darkColors.textSecondary,
  textDim: darkColors.textDisabled,
  dineIn: darkColors.success,
  parcel: darkColors.primary,
  online: darkColors.info,
  glow: "rgba(79, 140, 255, 0.35)",
  glass: darkColors.glass,
  info: darkColors.info,
  infoMuted: darkColors.infoMuted,
  purple: "#A78BFA",
  purpleMuted: "rgba(167, 139, 250, 0.14)",
  statusReady: darkColors.success,
  statusAccepted: darkColors.info,
  statusPreparing: darkColors.primary,
  statusCancelled: darkColors.danger,
  statusCompleted: darkColors.textDisabled
};

export const posSpacing = {
  xs: spacing[1],
  sm: spacing[2],
  md: spacing[3],
  lg: spacing[4],
  xl: spacing[5],
  xxl: spacing[6],
  xxxl: spacing[8],
  huge: spacing[12]
} as const;

export const posRadius = {
  sm: radius.md,
  md: radius.lg,
  lg: radius.xl,
  xl: radius["2xl"],
  pill: radius.full
} as const;

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

export function posGlass(): ViewStyle {
  return {
    backgroundColor: posColors.glass,
    borderWidth: 1,
    borderColor: posColors.border,
    ...Platform.select({
      web: { backdropFilter: "blur(12px)" } as ViewStyle,
      default: {}
    })
  };
}

/** Build POS colors from resolved theme at runtime */
export function posColorsForTheme(resolved: "light" | "dark") {
  const c = resolved === "dark" ? darkColors : lightColors;
  return {
    ...posColors,
    bg: c.background,
    secondary: c.surface,
    card: c.card,
    cardHover: c.hover,
    border: c.divider,
    borderStrong: c.border,
    text: c.textPrimary,
    textSecondary: c.textSecondary,
    textDim: c.textDisabled,
    glass: c.glass
  };
}
