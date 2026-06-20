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
  danger: "#EF4444",
  dangerMuted: "rgba(239,68,68,0.14)",
  text: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textDim: "#71717A",
  parcel: "#FF7A00",
  online: "#38BDF8",
  purple: "#8B5CF6",
  purpleMuted: "rgba(139,92,246,0.14)"
} as const;

export type PlatformTab = "parcel" | "swiggy" | "zomato" | "online" | "waiter";

export const PLATFORM_TABS: Array<{
  id: PlatformTab;
  label: string;
  emoji: string;
  color: string;
}> = [
  { id: "parcel", label: "Parcel", emoji: "🛍", color: posColors.parcel },
  { id: "swiggy", label: "Swiggy", emoji: "🛵", color: "#F97316" },
  { id: "zomato", label: "Zomato", emoji: "🍔", color: "#E23744" },
  { id: "online", label: "Online", emoji: "🌐", color: posColors.online },
  { id: "waiter", label: "Waiter", emoji: "👨", color: posColors.success }
];

export function platformToSource(tab: PlatformTab): "dine-in" | "takeaway" | "zomato" | "swiggy" {
  if (tab === "swiggy") return "swiggy";
  if (tab === "zomato") return "zomato";
  if (tab === "waiter") return "dine-in";
  return "takeaway";
}

export function categoryIcon(name: string): string {
  const key = name.toLowerCase();
  if (key === "all") return "◉";
  if (key.includes("juice") || key.includes("beverage")) return "🍹";
  if (key.includes("milk") || key.includes("shake")) return "🥛";
  if (key.includes("dessert")) return "🍰";
  if (key.includes("snack") || key.includes("bowl")) return "🍽";
  return "🥤";
}

export function productPlaceholder(category: string): string {
  const key = category.toLowerCase();
  if (key.includes("juice") || key.includes("beverage")) return "🍊";
  if (key.includes("milk") || key.includes("shake")) return "🥤";
  if (key.includes("dessert")) return "🍨";
  if (key.includes("bowl")) return "🍉";
  if (key.includes("snack")) return "🥪";
  return "🍹";
}
