/** Kitchen KDS-style status colors: pending → yellow, preparing → orange, ready → green */

export type KitchenStatusBucket = "pending" | "preparing" | "ready" | "other";

export function bucketForStatus(status: string): KitchenStatusBucket {
  const s = status.toLowerCase();
  if (s === "pending" || s === "created" || s === "confirmed") return "pending";
  if (s === "preparing" || s === "accepted") return "preparing";
  if (s === "ready") return "ready";
  return "other";
}

export function themeForBucket(bucket: KitchenStatusBucket): {
  label: string;
  dot: string;
  accent: string;
  accentSoft: string;
  border: string;
  badgeBg: string;
  badgeFg: string;
} {
  switch (bucket) {
    case "pending":
      return {
        label: "Pending",
        dot: "#EAB308",
        accent: "#CA8A04",
        accentSoft: "#FEFCE8",
        border: "#FDE047",
        badgeBg: "#FEF9C3",
        badgeFg: "#854D0E"
      };
    case "preparing":
      return {
        label: "Preparing",
        dot: "#EA580C",
        accent: "#C2410C",
        accentSoft: "#FFF7ED",
        border: "#FDBA74",
        badgeBg: "#FFEDD5",
        badgeFg: "#9A3412"
      };
    case "ready":
      return {
        label: "Ready",
        dot: "#16A34A",
        accent: "#15803D",
        accentSoft: "#F0FDF4",
        border: "#86EFAC",
        badgeBg: "#DCFCE7",
        badgeFg: "#166534"
      };
    default:
      return {
        label: "Order",
        dot: "#64748B",
        accent: "#475569",
        accentSoft: "#F8FAFC",
        border: "#E2E8F0",
        badgeBg: "#F1F5F9",
        badgeFg: "#334155"
      };
  }
}

export function displayStatusLabel(status: string): string {
  const b = bucketForStatus(status);
  if (b === "other") return status.replace(/_/g, " ");
  return themeForBucket(b).label;
}
