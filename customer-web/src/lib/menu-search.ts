import type { Product } from "@/lib/menu-data-types";

/** Trim + lowercase — use for all menu category ↔ product `category` comparisons. */
export function normalizeMenuCategoryKey(str: unknown): string {
  return (str ?? "").toString().trim().toLowerCase();
}

export type MenuProductFilters = {
  /** Case-insensitive match on name (and description if no name match needed — name only per spec). */
  text: string;
  /**
   * When set, only products whose Firestore/API `category` string matches this name (after normalize).
   * Resolve `?category=<id>` to the category's `name` before passing — do not pass document ids here.
   */
  categoryName: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  popularOnly: boolean;
};

export function filterMenuProducts(products: Product[], f: MenuProductFilters): Product[] {
  const t = f.text.trim().toLowerCase();
  const want = f.categoryName != null ? normalizeMenuCategoryKey(f.categoryName) : "";
  const filterByCategory = want.length > 0;

  return products.filter((p) => {
    if (filterByCategory) {
      const pc = normalizeMenuCategoryKey((p as { category?: string }).category);
      if (pc !== want) return false;
    }
    if (t && !p.name.toLowerCase().includes(t)) return false;
    if (f.minPrice != null && Number.isFinite(f.minPrice) && p.price < f.minPrice) return false;
    if (f.maxPrice != null && Number.isFinite(f.maxPrice) && p.price > f.maxPrice) return false;
    if (f.popularOnly && p.popular !== true) return false;
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
