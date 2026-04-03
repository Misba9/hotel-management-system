"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/menu/product-card";
import dynamic from "next/dynamic";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { Product, getMenuPayload } from "@/lib/menu-data";
const ProductQuickViewModal = dynamic(
  () => import("@/components/menu/product-quick-view-modal").then((mod) => mod.ProductQuickViewModal),
  { ssr: false }
);

type SortMode = "popularity" | "rating" | "price";

export default function MenuPage() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category");
  const [activeCategory, setActiveCategory] = useState(initialCategory ?? "all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("popularity");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const loadMenu = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getMenuPayload(forceRefresh);
      setProducts(payload.products);
      setCategories(
        payload.categories.map((category) => ({
          id: category.id,
          name: category.name,
          count: category.count
        }))
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load menu from Firestore.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  const filtered = useMemo(() => {
    let data = products.filter((item) => {
      const categoryMatch = activeCategory === "all" || item.categoryId === activeCategory;
      const searchMatch = item.name.toLowerCase().includes(search.toLowerCase());
      return categoryMatch && searchMatch;
    });
    if (sort === "rating") data = [...data].sort((a, b) => b.rating - a.rating);
    if (sort === "price") data = [...data].sort((a, b) => a.price - b.price);
    if (sort === "popularity") data = [...data].sort((a, b) => Number(b.popular) - Number(a.popular));
    return data;
  }, [activeCategory, products, search, sort]);

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Menu</h1>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          aria-label="Search menu"
          placeholder="Search fresh juices, smoothies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
        <select
          aria-label="Sort by"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="popularity">Sort: Popularity</option>
          <option value="rating">Sort: Rating</option>
          <option value="price">Sort: Price</option>
        </select>
      </div>

      <div className="sticky top-16 z-30 -mx-4 border-b border-slate-200/80 bg-brand-background/95 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div
          className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Menu categories"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium shadow-sm transition ${
              activeCategory === "all"
                ? "bg-orange-500 text-white shadow-orange-500/25"
                : "border border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-orange-800"
            }`}
          >
            All
            {products.length > 0 ? (
              <span className="ml-1.5 tabular-nums opacity-90">({products.length})</span>
            ) : null}
          </button>
          {categories.map((category) => (
            <button
              type="button"
              role="tab"
              key={category.id}
              aria-selected={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium shadow-sm transition ${
                activeCategory === category.id
                  ? "bg-orange-500 text-white shadow-orange-500/25"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-orange-800"
              }`}
            >
              {category.name}
              {category.count > 0 ? (
                <span className="ml-1.5 tabular-nums opacity-90">({category.count})</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {!loading && error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadMenu(true)}
            className="self-start rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => <SkeletonCard key={idx} />)
          : filtered.map((item) => <ProductCard key={item.id} product={item} onQuickView={setSelectedProduct} />)}
      </div>
      {!loading && !error && products.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/80">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">No menu items yet</p>
          <p className="mt-2 text-sm text-slate-500">Check back soon — we&apos;re updating our Firestore catalog.</p>
        </div>
      ) : null}
      {!loading && !error && products.length > 0 && filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white/80 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/80">
          <p className="font-medium text-slate-800 dark:text-slate-100">Nothing matches this filter</p>
          <p className="mt-1 text-sm text-slate-500">Try another category or adjust your search.</p>
        </div>
      ) : null}
      {selectedProduct ? (
        <ProductQuickViewModal
          product={selectedProduct}
          open={Boolean(selectedProduct)}
          onOpenChange={(open) => {
            if (!open) setSelectedProduct(null);
          }}
        />
      ) : null}
    </section>
  );
}
