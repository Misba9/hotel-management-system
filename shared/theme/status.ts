/** Order, payment, and table status colors — theme-aware where possible. */

export const orderStatusColors = {
  pending: { light: "#D97706", dark: "#F59E0B", label: "Pending" },
  preparing: { light: "#2563EB", dark: "#4F8CFF", label: "Preparing" },
  ready: { light: "#16A34A", dark: "#22C55E", label: "Ready" },
  completed: { light: "#059669", dark: "#10B981", label: "Completed" },
  cancelled: { light: "#DC2626", dark: "#EF4444", label: "Cancelled" },
  refund: { light: "#7C3AED", dark: "#A78BFA", label: "Refund" }
} as const;

export const paymentStatusColors = {
  paid: { light: "#16A34A", dark: "#22C55E", label: "Paid" },
  unpaid: { light: "#EA580C", dark: "#F97316", label: "Unpaid" },
  partial: { light: "#D97706", dark: "#F59E0B", label: "Partial" }
} as const;

export const tableStatusColors = {
  available: { light: "#16A34A", dark: "#22C55E", label: "Available" },
  occupied: { light: "#DC2626", dark: "#EF4444", label: "Occupied" },
  reserved: { light: "#2563EB", dark: "#4F8CFF", label: "Reserved" },
  cleaning: { light: "#64748B", dark: "#94A3B8", label: "Cleaning" }
} as const;

export type OrderStatusKey = keyof typeof orderStatusColors;
export type PaymentStatusKey = keyof typeof paymentStatusColors;
export type TableStatusKey = keyof typeof tableStatusColors;

export function statusColor(
  map: Record<string, { light: string; dark: string }>,
  key: string,
  mode: "light" | "dark"
): string {
  const entry = map[key];
  if (!entry) return mode === "dark" ? "#707784" : "#94A3B8";
  return entry[mode];
}
