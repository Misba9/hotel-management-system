"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
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
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    async function loadMenu() {
      setLoading(true);
      setError(null);
      try {
        const payload = await getMenuPayload();
        setProducts(payload.products);
        setCategories(payload.categories.map((category) => ({ id: category.id, name: category.name })));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load menu.");
      } finally {
        setLoading(false);
      }
    }

    void loadMenu();
  }, []);

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

      <div className="sticky top-16 z-30 -mx-4 bg-brand-background/95 px-4 py-2 backdrop-blur dark:bg-slate-950/95">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveCategory("all")}
            className={`rounded-full px-4 py-1.5 text-sm ${
              activeCategory === "all" ? "bg-orange-500 text-white" : "bg-white dark:bg-slate-900"
            }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${
                activeCategory === category.id ? "bg-orange-500 text-white" : "bg-white dark:bg-slate-900"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => <SkeletonCard key={idx} />)
          : filtered.map((item) => <ProductCard key={item.id} product={item} onQuickView={setSelectedProduct} />)}
      </div>
      {!loading && error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      {!loading && !error && filtered.length === 0 ? (
        <p className="rounded-xl border bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900">
          No products found for this filter.
        </p>
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
