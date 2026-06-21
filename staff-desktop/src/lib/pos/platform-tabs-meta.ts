import type { PlatformTab } from "@/lib/pos/cashier-pos-store";

export type PlatformTabMeta = {
  id: PlatformTab;
  emoji: string;
  label: string;
  accent: string;
};

export const PLATFORM_TABS: PlatformTabMeta[] = [
  { id: "parcel", emoji: "📦", label: "Parcel", accent: "#0F766E" },
  { id: "swiggy", emoji: "🟠", label: "Swiggy", accent: "#F97316" },
  { id: "zomato", emoji: "🔴", label: "Zomato", accent: "#E23744" },
  { id: "online", emoji: "🌐", label: "Online", accent: "#0EA5E9" },
  { id: "waiter", emoji: "🍽", label: "Waiter", accent: "#22C55E" }
];
