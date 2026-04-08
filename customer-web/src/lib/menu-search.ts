import type { Product } from "@/lib/menu-data-types";

export type MenuProductFilters = {
  /** Case-insensitive match on name (and description if no name match needed — name only per spec). */
  text: string;
  /** When set, only this category id; omit or null for all. */
  categoryId: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  popularOnly: boolean;
};

export function filterMenuProducts(products: Product[], f: MenuProductFilters): Product[] {
  const t = f.text.trim().toLowerCase();
  return products.filter((p) => {
    if (f.categoryId && p.categoryId !== f.categoryId) return false;
    if (t && !p.name.toLowerCase().includes(t)) return false;
    if (f.minPrice != null && Number.isFinite(f.minPrice) && p.price < f.minPrice) return false;
    if (f.maxPrice != null && Number.isFinite(f.maxPrice) && p.price > f.maxPrice) return false;
    if (f.popularOnly && !p.popular) return false;
    return true;
  });
}

export function buildMenuUrl(filters: {
  q?: string;
  category?: string;
  min?: number | null;
  max?: number | null;
  popular?: boolean;
}): string {
  const p = new URLSearchParams();
  if (filters.q?.trim()) p.set("q", filters.q.trim());
  if (filters.category?.trim()) p.set("category", filters.category.trim());
  if (filters.min != null && Number.isFinite(filters.min)) p.set("min", String(filters.min));
  if (filters.max != null && Number.isFinite(filters.max)) p.set("max", String(filters.max));
  if (filters.popular) p.set("popular", "1");
  const qs = p.toString();
  return qs ? `/menu?${qs}` : "/menu";
}
