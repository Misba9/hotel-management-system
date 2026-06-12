import type { MenuItemDoc } from "../../components/cashier-pos/pos-types";
import type { CartLine } from "../../components/cashier-pos/pos-types";

export type ComboDeal = {
  id: string;
  name: string;
  items: string[];
  price: number;
  badge?: string;
};

/** Default combos — prices recalculated when products load. */
export const DEFAULT_COMBOS: ComboDeal[] = [
  { id: "combo_burger", name: "Burger Meal", items: ["burger", "fries", "coke"], price: 299, badge: "Best Seller" },
  { id: "combo_chinese", name: "Chinese Combo", items: ["noodles", "manchurian", "rice"], price: 349 },
  { id: "combo_juice", name: "Juice Pack", items: ["mango", "watermelon"], price: 199 }
];

export function resolveCombosFromMenu(products: MenuItemDoc[]): ComboDeal[] {
  if (products.length === 0) return DEFAULT_COMBOS;
  const byName = new Map(products.map((p) => [p.name.toLowerCase(), p]));
  return DEFAULT_COMBOS.map((combo) => {
    const matched = combo.items
      .map((needle) => products.find((p) => p.name.toLowerCase().includes(needle)))
      .filter(Boolean) as MenuItemDoc[];
    const sum = matched.reduce((s, p) => s + p.price, 0);
    return { ...combo, price: sum > 0 ? Math.min(combo.price, Math.round(sum * 0.9)) : combo.price };
  });
}

export function comboToCartLines(combo: ComboDeal, products: MenuItemDoc[]): CartLine[] {
  const lines: CartLine[] = [];
  for (const needle of combo.items) {
    const p = products.find((x) => x.name.toLowerCase().includes(needle));
    if (p) lines.push({ menuItemId: p.id, name: p.name, unitPrice: p.price, qty: 1 });
  }
  if (lines.length === 0) {
    lines.push({ menuItemId: combo.id, name: combo.name, unitPrice: combo.price, qty: 1 });
  }
  return lines;
}
