import type { StaffOrderRow } from "../../../services/orders";

export type KitchenStage =
  | "received"
  | "accepted"
  | "preparing"
  | "ready"
  | "served"
  | "completed";

export const KITCHEN_STAGES: { id: KitchenStage; label: string; color: string }[] = [
  { id: "received", label: "Received", color: "#64748B" },
  { id: "accepted", label: "Accepted", color: "#3B82F6" },
  { id: "preparing", label: "Preparing", color: "#F59E0B" },
  { id: "ready", label: "Ready", color: "#22C55E" },
  { id: "served", label: "Served", color: "#8B5CF6" },
  { id: "completed", label: "Completed", color: "#10B981" }
];

export function resolveKitchenStage(order: StaffOrderRow): KitchenStage {
  const canon = String(order.canonicalStatus ?? "").toLowerCase();
  const raw = String(order.status ?? "").toUpperCase();

  if (canon === "served" || raw === "SERVED" || raw === "COMPLETED") return "served";
  if (canon === "ready" || raw === "READY") return "ready";
  if (canon === "preparing" || raw === "PREPARING" || raw === "PLACED") return "preparing";
  if (raw === "ACCEPTED" || raw === "CONFIRMED") return "accepted";
  if (String(order.paymentStatus ?? "").toLowerCase() === "paid") return "completed";
  return "received";
}

export function kitchenStageIndex(stage: KitchenStage): number {
  return KITCHEN_STAGES.findIndex((s) => s.id === stage);
}
