import type { CartLine } from "../../components/cashier-pos/pos-types";

export type HeldOrder = {
  id: string;
  label: string;
  cart: CartLine[];
  customerName?: string;
  phone?: string;
  orderType: string;
  tableLabel?: string;
  heldAt: string;
  note?: string;
};

const KEY = "cashier_pos_held_orders";

type WebStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function storage(): WebStorage | null {
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as { localStorage?: WebStorage; sessionStorage?: WebStorage };
  return g.sessionStorage ?? g.localStorage ?? null;
}

export function loadHeldOrders(): HeldOrder[] {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HeldOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHeldOrder(entry: Omit<HeldOrder, "id" | "heldAt"> & { id?: string }): HeldOrder {
  const list = loadHeldOrders();
  const row: HeldOrder = {
    id: entry.id ?? `hold_${Date.now()}`,
    heldAt: new Date().toISOString(),
    label: entry.label,
    cart: entry.cart,
    customerName: entry.customerName,
    phone: entry.phone,
    orderType: entry.orderType,
    tableLabel: entry.tableLabel,
    note: entry.note
  };
  list.unshift(row);
  storage()?.setItem(KEY, JSON.stringify(list.slice(0, 20)));
  return row;
}

export function removeHeldOrder(id: string): void {
  const list = loadHeldOrders().filter((h) => h.id !== id);
  storage()?.setItem(KEY, JSON.stringify(list));
}
