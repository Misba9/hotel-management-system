import { create } from "zustand";
import type { StaffOrderRow } from "../../../services/orders";
import { generateTestOrders, type TestPlatform } from "./cashier-test-orders";
import type { OrderStatusFilter } from "./order-source";
import { DEFAULT_PLATFORM_STATUS_FILTERS } from "./platform-status-filters";

export type PlatformTab = "parcel" | "swiggy" | "zomato" | "online" | "waiter";

export type CashierPosState = {
  platformFilter: PlatformTab;
  /** Independent status filter per platform module. */
  statusFilters: Record<PlatformTab, OrderStatusFilter>;
  orderSearch: string;
  selectedOrderId: string | null;
  showOrderModal: boolean;
  showTestPanel: boolean;
  showRecentParcelDrawer: boolean;
  firestoreOrders: StaffOrderRow[];
  ordersLoading: boolean;
  ordersError: string | null;
  testOrders: StaffOrderRow[];
  randomStatus: boolean;
  randomPayment: boolean;
  randomTime: boolean;

  setPlatformFilter: (p: PlatformTab) => void;
  setPlatformStatusFilter: (platform: PlatformTab, status: OrderStatusFilter) => void;
  setOrderSearch: (q: string) => void;
  selectOrder: (id: string | null) => void;
  openOrderModal: (id: string) => void;
  closeOrderModal: () => void;
  setShowTestPanel: (v: boolean) => void;
  setShowRecentParcelDrawer: (v: boolean) => void;
  setFirestoreOrders: (orders: StaffOrderRow[], loading: boolean, error: string | null) => void;
  cancelTestOrder: (id: string, reason: string) => void;
  setRandomStatus: (v: boolean) => void;
  setRandomPayment: (v: boolean) => void;
  setRandomTime: (v: boolean) => void;
  generateTest: (platform: TestPlatform | "mixed", count?: number) => void;
  clearTestOrders: () => void;
};

export const useCashierPosStore = create<CashierPosState>((set, get) => ({
  platformFilter: "parcel",
  statusFilters: { ...DEFAULT_PLATFORM_STATUS_FILTERS },
  orderSearch: "",
  selectedOrderId: null,
  showOrderModal: false,
  showTestPanel: false,
  showRecentParcelDrawer: false,
  firestoreOrders: [],
  ordersLoading: true,
  ordersError: null,
  testOrders: [],
  randomStatus: true,
  randomPayment: true,
  randomTime: true,

  setPlatformFilter: (p) => set({ platformFilter: p, orderSearch: "" }),
  setPlatformStatusFilter: (platform, status) =>
    set((s) => ({
      statusFilters: { ...s.statusFilters, [platform]: status }
    })),
  setOrderSearch: (q) => set({ orderSearch: q }),
  selectOrder: (id) => set({ selectedOrderId: id }),
  openOrderModal: (id) => set({ selectedOrderId: id, showOrderModal: true }),
  closeOrderModal: () => set({ showOrderModal: false }),
  setShowTestPanel: (v) => set({ showTestPanel: v }),
  setShowRecentParcelDrawer: (v) => set({ showRecentParcelDrawer: v }),
  setFirestoreOrders: (orders, loading, error) =>
    set({ firestoreOrders: orders, ordersLoading: loading, ordersError: error }),

  setRandomStatus: (v) => set({ randomStatus: v }),
  setRandomPayment: (v) => set({ randomPayment: v }),
  setRandomTime: (v) => set({ randomTime: v }),

  generateTest: (platform, count = 1) => {
    const { randomStatus, randomPayment, randomTime } = get();
    const generated = generateTestOrders(platform, count, { randomStatus, randomPayment, randomTime });
    set((s) => ({ testOrders: [...generated, ...s.testOrders] }));
  },

  clearTestOrders: () => set({ testOrders: [] }),

  cancelTestOrder: (id, reason) => {
    set((s) => ({
      testOrders: s.testOrders.map((o) =>
        o.id === id
          ? ({
              ...o,
              status: "cancelled",
              canonicalStatus: "cancelled",
              cancelledBy: "Cashier",
              cancelReason: reason
            } as StaffOrderRow & { cancelledBy: string; cancelReason: string })
          : o
      )
    }));
  }
}));

export {
  buildCashierOrdersView,
  mergeCashierOrders,
  mergeCashierOrders as mergeOrders,
  getOrdersForPlatform,
  computeLiveCounts
} from "./cashier-orders-view";
