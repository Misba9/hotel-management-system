import type { StaffOrderRow } from "../../../services/orders";
import { filterCashierOrders } from "../cashier-order-filters";
import type { OrderStatusFilter } from "./order-source";
import { countTodayParcelOrders, getParcelOrders } from "./parcel-recent-orders";
import type { PlatformTab } from "./cashier-pos-store";
import { partitionOrdersByPlatform } from "./cashier-test-orders";
import { PLATFORM_STATUS_OPTIONS } from "./platform-status-filters";

export const CASHIER_PLATFORMS: PlatformTab[] = ["parcel", "swiggy", "zomato", "online", "waiter"];

export type PlatformOrderBuckets = {
  parcelOrders: StaffOrderRow[];
  swiggyOrders: StaffOrderRow[];
  zomatoOrders: StaffOrderRow[];
  onlineOrders: StaffOrderRow[];
  waiterOrders: StaffOrderRow[];
};

export type CashierOrdersView = {
  allOrders: StaffOrderRow[];
  parcelOrders: StaffOrderRow[];
  swiggyOrders: StaffOrderRow[];
  zomatoOrders: StaffOrderRow[];
  onlineOrders: StaffOrderRow[];
  waiterOrders: StaffOrderRow[];
  /** Total orders per platform (status = all). */
  platformCounts: Record<PlatformTab, number>;
  /** Per-platform status counts — each module only uses its own bucket. */
  platformStatusCounts: Record<PlatformTab, Record<OrderStatusFilter, number>>;
  todayParcelCount: number;
  /** Orders for the active platform + its status filter + search. */
  visibleOrders: StaffOrderRow[];
};

function getPlatformBucket(buckets: PlatformOrderBuckets, platform: PlatformTab): StaffOrderRow[] {
  switch (platform) {
    case "parcel":
      return buckets.parcelOrders;
    case "swiggy":
      return buckets.swiggyOrders;
    case "zomato":
      return buckets.zomatoOrders;
    case "online":
      return buckets.onlineOrders;
    case "waiter":
      return buckets.waiterOrders;
  }
}

function countStatusForOrders(orders: StaffOrderRow[], status: OrderStatusFilter): number {
  return filterCashierOrders(orders, { search: "", source: "all", status }).length;
}

function filterPlatformOrders(
  orders: StaffOrderRow[],
  status: OrderStatusFilter,
  search: string
): StaffOrderRow[] {
  return filterCashierOrders(orders, { search, source: "all", status });
}

/** Derive per-platform order buckets, counts, and the active module list. */
export function buildCashierOrdersView(
  allOrders: StaffOrderRow[],
  platformFilter: PlatformTab,
  statusFilters: Record<PlatformTab, OrderStatusFilter>,
  orderSearch: string
): CashierOrdersView {
  const buckets = partitionOrdersByPlatform(allOrders);

  const platformCounts = {
    parcel: buckets.parcelOrders.length,
    swiggy: buckets.swiggyOrders.length,
    zomato: buckets.zomatoOrders.length,
    online: buckets.onlineOrders.length,
    waiter: buckets.waiterOrders.length
  } satisfies Record<PlatformTab, number>;

  const platformStatusCounts = {} as Record<PlatformTab, Record<OrderStatusFilter, number>>;
  for (const platform of CASHIER_PLATFORMS) {
    const slice = getPlatformBucket(buckets, platform);
    const counts = {} as Record<OrderStatusFilter, number>;
    for (const opt of PLATFORM_STATUS_OPTIONS[platform]) {
      counts[opt.id] = countStatusForOrders(slice, opt.id);
    }
    platformStatusCounts[platform] = counts;
  }

  const activeSlice = getPlatformBucket(buckets, platformFilter);
  const activeStatus = statusFilters[platformFilter];
  const visibleOrders = filterPlatformOrders(activeSlice, activeStatus, orderSearch);

  return {
    allOrders,
    parcelOrders: buckets.parcelOrders,
    swiggyOrders: buckets.swiggyOrders,
    zomatoOrders: buckets.zomatoOrders,
    onlineOrders: buckets.onlineOrders,
    waiterOrders: buckets.waiterOrders,
    platformCounts,
    platformStatusCounts,
    todayParcelCount: countTodayParcelOrders(buckets.parcelOrders),
    visibleOrders
  };
}

export function mergeCashierOrders(firestore: StaffOrderRow[], test: StaffOrderRow[]): StaffOrderRow[] {
  const testIds = new Set(test.map((o) => o.id));
  return [...test, ...firestore.filter((o) => !testIds.has(o.id))];
}

/** Filter parcel orders using the parcel module's own status + search. */
export function filterParcelModuleOrders(
  parcelOrders: StaffOrderRow[],
  status: OrderStatusFilter,
  search: string
): StaffOrderRow[] {
  return filterPlatformOrders(parcelOrders, status, search);
}

/** @deprecated Use buildCashierOrdersView */
export function computeLiveCounts(orders: StaffOrderRow[]) {
  const parts = partitionOrdersByPlatform(orders);
  return {
    parcel: parts.parcelOrders.length,
    swiggy: parts.swiggyOrders.length,
    zomato: parts.zomatoOrders.length,
    online: parts.onlineOrders.length,
    waiter: parts.waiterOrders.length,
    orders: orders.length
  };
}

/** @deprecated Use buildCashierOrdersView */
export function getOrdersForPlatform(
  orders: StaffOrderRow[],
  platform: PlatformTab,
  status: OrderStatusFilter,
  search: string
): StaffOrderRow[] {
  const buckets = partitionOrdersByPlatform(orders);
  return filterPlatformOrders(getPlatformBucket(buckets, platform), status, search);
}

/** @deprecated Use mergeCashierOrders */
export const mergeOrders = mergeCashierOrders;

/** @deprecated Use getParcelOrders */
export { getParcelOrders };
