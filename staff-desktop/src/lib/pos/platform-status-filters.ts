import type { PlatformTab } from "./cashier-pos-store";
import type { OrderStatusFilter } from "@/lib/pos/order-source";

export type PlatformStatusOption = { id: OrderStatusFilter; label: string };

export const PARCEL_STATUS_OPTIONS: PlatformStatusOption[] = [
  { id: "all", label: "All" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "paid", label: "Paid" },
  { id: "cancelled", label: "Cancelled" },
  { id: "completed", label: "Completed" },
  { id: "refunded", label: "Refunded" }
];

export const AGGREGATOR_STATUS_OPTIONS: PlatformStatusOption[] = [
  { id: "all", label: "All" },
  { id: "accepted", label: "Accepted" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "picked_up", label: "Picked Up" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" }
];

export const ONLINE_STATUS_OPTIONS: PlatformStatusOption[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "refunded", label: "Refunded" }
];

export const WAITER_STATUS_OPTIONS: PlatformStatusOption[] = [
  { id: "all", label: "All" },
  { id: "received", label: "Received" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "served", label: "Served" },
  { id: "paid", label: "Paid" },
  { id: "cancelled", label: "Cancelled" }
];

export const PLATFORM_STATUS_OPTIONS: Record<PlatformTab, PlatformStatusOption[]> = {
  parcel: PARCEL_STATUS_OPTIONS,
  swiggy: AGGREGATOR_STATUS_OPTIONS,
  zomato: AGGREGATOR_STATUS_OPTIONS,
  online: ONLINE_STATUS_OPTIONS,
  waiter: WAITER_STATUS_OPTIONS
};

export const DEFAULT_PLATFORM_STATUS_FILTERS: Record<PlatformTab, OrderStatusFilter> = {
  parcel: "all",
  swiggy: "all",
  zomato: "all",
  online: "all",
  waiter: "all"
};
