/**
 * Human-readable line for order cards (Zomato-style: "2× Burger · 1× Fries").
 */
export type OrderItemLike = {
  name?: string;
  quantity?: number;
  qty?: number;
};

export function summarizeOrderItems(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return "";
  const parts: string[] = [];
  for (const raw of items) {
    const row = raw as OrderItemLike;
    const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : "Item";
    const q =
      typeof row.quantity === "number" && row.quantity > 0
        ? row.quantity
        : typeof row.qty === "number" && row.qty > 0
          ? row.qty
          : 1;
    parts.push(`${q}× ${name}`);
  }
  return parts.join(" · ");
}
