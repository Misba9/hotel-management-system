/**
 * Food-delivery inspired palette (mobile-first staff shell).
 */
export const shell = {
  bg: "#F4F6FA",
  surface: "#FFFFFF",
  text: "#1A1A2E",
  muted: "#6B7280",
  border: "#E8ECF2",
  primary: "#E23744",
  primaryDark: "#C42F3A",
  accent: "#FF6B35",
  success: "#0D9488",
  warning: "#F59E0B",
  orange: "#EA580C",
  chipBg: "#FFF1F2",
  shadow: "rgba(15, 23, 42, 0.08)"
};

export function shellShadow(elevation = 4) {
  return {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: elevation / 2 },
    shadowOpacity: 0.09,
    shadowRadius: elevation,
    elevation: Math.min(elevation, 8)
  };
}
