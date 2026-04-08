"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/menu/product-card";
import { MenuCategoryUrlSync } from "@/components/menu/menu-category-url-sync";
import dynamic from "next/dynamic";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { useDebounce } from "@/hooks/use-debounce";
import { Product, getMenuPayload } from "@/lib/menu-data";
import { fetchReviewSummaries, type ReviewSummary } from "@/lib/reviews-client";
import { filterMenuProducts } from "@/lib/menu-search";
import { MENU_ALL_CATEGORY_ID, useMenuCategory } from "@/context/menu-category-context";
import { Star } from "lucide-react";

const ProductQuickViewModal = dynamic(
  () => import("@/components/menu/product-quick-view-modal").then((mod) => mod.ProductQuickViewModal),
  { ssr: false }
);

type SortMode = "popularity" | "rating" | "price";

function MenuPageInner() {
  const searchParams = useSearchParams();
  const { selectedCategoryId: activeCategory, setSelectedCategoryId: setActiveCategory } = useMenuCategory();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 280);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [popularOnly, setPopularOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>("popularity");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [reviewSummaries, setReviewSummaries] = useState<Record<string, ReviewSummary>>({});

  useEffect(() => {
    const q = searchParams.get("q");
    if (q != null) setSearch(q);
    const min = searchParams.get("min");
    if (min != null) setMinPrice(min);
    const max = searchParams.get("max");
    if (max != null) setMaxPrice(max);
    setPopularOnly(searchParams.get("popular") === "1");
  }, [searchParams]);

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

  useEffect(() => {
    if (products.length === 0) {
      setReviewSummaries({});
      return;
    }
    const ids = products.map((p) => p.id);
    void fetchReviewSummaries(ids).then(setReviewSummaries);
  }, [products]);

  const minN = minPrice === "" ? null : Number(minPrice);
  const maxN = maxPrice === "" ? null : Number(maxPrice);

  const filtered = useMemo(() => {
    let data = filterMenuProducts(products, {
      text: debouncedSearch,
      categoryId: activeCategory === MENU_ALL_CATEGORY_ID ? null : activeCategory,
      minPrice: minN != null && Number.isFinite(minN) ? minN : null,
      maxPrice: maxN != null && Number.isFinite(maxN) ? maxN : null,
      popularOnly
    });
    if (sort === "rating") data = [...data].sort((a, b) => b.rating - a.rating);
    if (sort === "price") data = [...data].sort((a, b) => a.price - b.price);
    if (sort === "popularity") data = [...data].sort((a, b) => Number(b.popular) - Number(a.popular));
    return data;
  }, [activeCategory, debouncedSearch, maxN, minN, popularOnly, products, sort]);

  return (
    <section className="space-y-4 sm:space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl">Menu</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <input
          aria-label="Search menu"
          placeholder="Search fresh juices, smoothies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:px-4 sm:text-base dark:border-slate-700 dark:bg-slate-900"
        />
        <select
          aria-label="Sort by"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:w-auto sm:px-4 sm:text-base dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="popularity">Sort: Popularity</option>
          <option value="rating">Sort: Rating</option>
          <option value="price">Sort: Price</option>
        </select>
      </div>

      <div className="flex flex-col flex-wrap gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 shadow-md transition-all duration-200 dark:border-slate-700 dark:bg-slate-900/80 sm:flex-row sm:items-end sm:rounded-2xl sm:p-4">
        <div className="grid w-full gap-2 sm:w-auto sm:min-w-[120px]">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Min price (₹)</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="Any"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
          />
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:min-w-[120px]">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Max price (₹)</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="Any"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600">
          <input
            type="checkbox"
            checked={popularOnly}
            onChange={(e) => setPopularOnly(e.target.checked)}
            className="rounded border-slate-300"
          />
          <Star className="h-4 w-4 text-amber-500" aria-hidden />
          Popular only
        </label>
        <button
          type="button"
          onClick={() => {
            setMinPrice("");
            setMaxPrice("");
            setPopularOnly(false);
            setSearch("");
            setActiveCategory(MENU_ALL_CATEGORY_ID);
          }}
          className="w-full text-sm font-medium text-orange-600 hover:underline dark:text-orange-400 sm:ml-auto sm:w-auto"
        >
          Clear filters
        </button>
      </div>

      <div className="sticky top-[7.5rem] z-30 -mx-4 border-b border-slate-200/80 bg-brand-background/95 px-4 py-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:py-3 md:top-[8.5rem] md:py-3 lg:top-36">
        <div
          className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Menu categories"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === MENU_ALL_CATEGORY_ID}
            onClick={() => setActiveCategory(MENU_ALL_CATEGORY_ID)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium shadow-sm transition ${
              activeCategory === MENU_ALL_CATEGORY_ID
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => <SkeletonCard key={idx} />)
          : filtered.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                onQuickView={setSelectedProduct}
                reviewAverage={reviewSummaries[item.id]?.average}
                reviewCount={reviewSummaries[item.id]?.count}
              />
            ))}
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
          <p className="mt-1 text-sm text-slate-500">Try another category, price range, or search term.</p>
        </div>
      ) : null}
      {selectedProduct ? (
        <ProductQuickViewModal
          product={selectedProduct}
          open={Boolean(selectedProduct)}
          onOpenChange={(open) => {
            if (!open) setSelectedProduct(null);
          }}
          reviewAverage={selectedProduct ? reviewSummaries[selectedProduct.id]?.average : undefined}
          reviewCount={selectedProduct ? reviewSummaries[selectedProduct.id]?.count : undefined}
        />
      ) : null}
    </section>
  );
}

export default function MenuPage() {
  return (
    <>
      <Suspense fallback={null}>
        <MenuCategoryUrlSync />
        <MenuPageInner />
      </Suspense>
    </>
  );
}
