/** Shadow tokens for web (CSS) and React Native. */

export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
  md: "0 4px 12px rgba(0, 0, 0, 0.12)",
  lg: "0 8px 24px rgba(0, 0, 0, 0.18)",
  xl: "0 12px 40px rgba(0, 0, 0, 0.25)",
  card: "0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
  cardDark: "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
  glow: "0 0 40px rgba(79, 140, 255, 0.15)",
  glowSm: "0 0 20px rgba(79, 140, 255, 0.12)",
  dropdown: "0 8px 32px rgba(0, 0, 0, 0.35)"
} as const;

export const elevation = {
  0: shadows.sm,
  1: shadows.md,
  2: shadows.lg,
  3: shadows.xl,
  4: shadows.cardDark
} as const;
