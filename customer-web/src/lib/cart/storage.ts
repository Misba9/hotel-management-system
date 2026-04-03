import type { CartLine } from "./types";

export const CART_STORAGE_KEY = "nausheen_cart_cache";

export type PersistedCartState = {
  items: CartLine[];
  discount: number;
  couponCode: string;
};

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.price === "number" &&
    Number.isFinite(o.price) &&
    typeof o.image === "string" &&
    typeof o.qty === "number" &&
    Number.isInteger(o.qty) &&
    o.qty >= 0
  );
}

export function loadPersistedCart(raw: string | null): PersistedCartState | null {
  if (raw == null || raw === "") return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const o = data as Record<string, unknown>;
    const rawItems = o.items;
    if (!Array.isArray(rawItems)) return null;
    const items = rawItems.filter(isCartLine);
    return {
      items,
      discount: Math.max(0, Math.floor(Number(o.discount ?? 0))),
      couponCode: String(o.couponCode ?? "")
    };
  } catch {
    return null;
  }
}

export function persistCart(state: PersistedCartState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        items: state.items,
        discount: state.discount,
        couponCode: state.couponCode
      })
    );
  } catch {
    try {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function clearPersistedCart(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
