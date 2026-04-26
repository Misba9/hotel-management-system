"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/menu/product-card";
import dynamic from "next/dynamic";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { useDebounce } from "@/hooks/use-debounce";
import type { Category, Product } from "@/lib/menu-data";
import { fetchReviewSummaries, type ReviewSummary } from "@/lib/reviews-client";
import { filterMenuProducts, normalizeMenuCategoryKey } from "@/lib/menu-search";
import { MENU_IMAGE_FALLBACK } from "@/lib/image-url";
import { Star } from "lucide-react";

const ProductQuickViewModal = dynamic(
  () => import("@/components/menu/product-quick-view-modal").then((mod) => mod.ProductQuickViewModal),
  { ssr: false }
);

const MENU_GRID_SKELETON_KEYS = ["ms1", "ms2", "ms3", "ms4", "ms5", "ms6"] as const;

type SortMode = "popularity" | "rating" | "price";

type MenuCategoryTab = Category;

type ApiMenuJson = {
  categories?: unknown[];
  products?: unknown[];
  items?: Array<Record<string, unknown>>;
  error?: string;
};

function normalizeProductRow(row: Record<string, unknown>, docId?: string): Product | null {
  const id = String(row.id ?? docId ?? "").trim();
  const name = String(row.name ?? "").trim();
  const price = Number(row.price ?? NaN);
  if (!id || !name || !Number.isFinite(price) || price < 0) return null;

  const isAvailable =
    row.isAvailable !== false && row.available !== false && row.availability !== false;

  const rawCategory = String(row.category ?? "").trim();
  const categoryId = String(row.categoryId ?? rawCategory ?? "").trim() || "uncategorized";
  const categoryName = String(row.categoryName ?? rawCategory ?? "").trim() || "Menu";
  const category = rawCategory || categoryName || categoryId;

  const imageRaw = String(row.image ?? row.imageUrl ?? "").trim();
  const image = imageRaw || MENU_IMAGE_FALLBACK;

  return {
    id,
    name,
    description: String(row.description ?? row.ingredients ?? "").trim(),
    categoryId,
    categoryName,
    category,
    price,
    rating: Number.isFinite(Number(row.rating)) ? Number(row.rating) : 4.5,
    image,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients.map((x) => String(x)) : [],
    sizes: [{ label: "Medium", multiplier: 1 }],
    available: isAvailable,
    isAvailable,
    featured: Boolean(row.featured ?? row.isFeatured),
    popular: Boolean(row.popular ?? row.isPopular)
  };
}

function normalizeProductsFromApi(data: ApiMenuJson): Product[] {
  const rawProducts = data.products;
  if (Array.isArray(rawProducts) && rawProducts.length > 0) {
    return (rawProducts as Record<string, unknown>[])
      .map((row) => normalizeProductRow(row))
      .filter((p): p is Product => Boolean(p));
  }
  const items = data.items;
  if (Array.isArray(items) && items.length > 0) {
    return items.map((row) => normalizeProductRow(row)).filter((p): p is Product => Boolean(p));
  }
  return [];
}

function normalizeCategoriesFromApi(data: ApiMenuJson): MenuCategoryTab[] {
  const raw = data.categories;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return (raw as Record<string, unknown>[])
    .map((o) => {
      const id = String(o.id ?? "").trim();
      const name = String(o.name ?? "").trim();
      if (!id || !name) return null;
      const imageRaw = String(o.image ?? o.imageUrl ?? "").trim();
      const image = imageRaw || MENU_IMAGE_FALLBACK;
      const count = typeof o.count === "number" && Number.isFinite(o.count) ? o.count : Number(o.count ?? 0) || 0;
      const isActive = o.isActive !== false && o.active !== false;
      return { id, name, image, count, isActive } as MenuCategoryTab;
    })
    .filter((c): c is MenuCategoryTab => Boolean(c));
}

function MenuPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  /** `"all"` or a category display name (matches `product.category` after normalize). */
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 280);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [popularOnly, setPopularOnly] = useState(false);
  const [sort, setSort] = useState<SortMode>("popularity");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<MenuCategoryTab[]>([]);
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
      const url = forceRefresh ? `/api/menu?t=${Date.now()}` : "/api/menu";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Menu request failed (${res.status}).`);
      }
      const data = (await res.json()) as ApiMenuJson;
      if (typeof data.error === "string" && data.error) {
        throw new Error(data.error);
      }
      if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
        console.log("API MENU:", data);
      }
      const nextProducts = normalizeProductsFromApi(data);
      const nextCategories = normalizeCategoriesFromApi(data);
      setProducts(nextProducts);
      setCategories(nextCategories);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load menu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  const visibleCategories = useMemo(() => categories.filter((c) => c.isActive !== false), [categories]);

  const visibleProducts = useMemo(() => products.filter((p) => p.isAvailable !== false), [products]);

  /** Sync `?category=` (id or name) → local `selectedCategory` (canonical category name or `"all"`). */
  useEffect(() => {
    if (loading) return;
    const param = searchParams.get("category")?.trim();
    if (!param || param.toLowerCase() === "all") {
      setSelectedCategory("all");
      return;
    }
    if (visibleCategories.length === 0) return;

    const byId = visibleCategories.find((c) => c.id === param);
    if (byId) {
      setSelectedCategory(byId.name);
      return;
    }
    const byName = visibleCategories.find(
      (c) => normalizeMenuCategoryKey(c.name) === normalizeMenuCategoryKey(param)
    );
    if (byName) {
      setSelectedCategory(byName.name);
      return;
    }

    setSelectedCategory("all");
    const p = new URLSearchParams(searchParams.toString());
    p.delete("category");
    const qs = p.toString();
    router.replace(qs ? `/menu?${qs}` : "/menu");
  }, [loading, router, searchParams, visibleCategories]);

  useEffect(() => {
    if (visibleProducts.length === 0) {
      setReviewSummaries({});
      return;
    }
    const ids = visibleProducts.map((p) => p.id);
    void fetchReviewSummaries(ids).then(setReviewSummaries);
  }, [visibleProducts]);

  const minN = minPrice === "" ? null : Number(minPrice);
  const maxN = maxPrice === "" ? null : Number(maxPrice);

  const categoryScopedProducts = useMemo(() => {
    if (selectedCategory === "all") return visibleProducts;
    return visibleProducts.filter(
      (p) => normalizeMenuCategoryKey(p.category) === normalizeMenuCategoryKey(selectedCategory)
    );
  }, [selectedCategory, visibleProducts]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    for (const cat of visibleCategories) {
      console.log("CATEGORY NAME:", cat.name);
    }
    for (const p of visibleProducts) {
      console.log("PRODUCT CATEGORY:", p.category);
    }
  }, [visibleCategories, visibleProducts]);

  const filteredProducts = useMemo(() => {
    let data = filterMenuProducts(categoryScopedProducts, {
      text: debouncedSearch,
      categoryName: null,
      minPrice: minN != null && Number.isFinite(minN) ? minN : null,
      maxPrice: maxN != null && Number.isFinite(maxN) ? maxN : null,
      popularOnly
    });
    if (sort === "rating") data = [...data].sort((a, b) => b.rating - a.rating);
    if (sort === "price") data = [...data].sort((a, b) => a.price - b.price);
    if (sort === "popularity") data = [...data].sort((a, b) => Number(b.popular) - Number(a.popular));
    return data;
  }, [categoryScopedProducts, debouncedSearch, maxN, minN, popularOnly, sort]);

  const replaceCategoryInUrl = useCallback(
    (next: "all" | MenuCategoryTab) => {
      const p = new URLSearchParams(searchParams.toString());
      if (next === "all") {
        p.delete("category");
      } else {
        p.set("category", next.id);
      }
      const qs = p.toString();
      router.replace(qs ? `/menu?${qs}` : "/menu", { scroll: false });
    },
    [router, searchParams]
  );

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
            setSelectedCategory("all");
            replaceCategoryInUrl("all");
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
            aria-selected={selectedCategory === "all"}
            onClick={() => {
              setSelectedCategory("all");
              replaceCategoryInUrl("all");
            }}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium shadow-sm transition ${
              selectedCategory === "all"
                ? "bg-orange-500 text-white shadow-orange-500/25"
                : "border border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-orange-800"
            }`}
          >
            All
            {visibleProducts.length > 0 ? (
              <span className="ml-1.5 tabular-nums opacity-90">({visibleProducts.length})</span>
            ) : null}
          </button>
          {visibleCategories.map((category) => {
            const countInTab = visibleProducts.filter(
              (p) => normalizeMenuCategoryKey(p.category) === normalizeMenuCategoryKey(category.name)
            ).length;
            return (
              <button
                type="button"
                role="tab"
                key={category.id}
                aria-selected={selectedCategory === category.name}
                onClick={() => {
                  setSelectedCategory(category.name);
                  replaceCategoryInUrl(category);
                }}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium shadow-sm transition ${
                  selectedCategory === category.name
                    ? "bg-orange-500 text-white shadow-orange-500/25"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-orange-800"
                }`}
              >
                {category.name}
                <span className="ml-1.5 tabular-nums opacity-90">({countInTab})</span>
              </button>
            );
          })}
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
          ? Array.from({ length: 6 }).map((_, idx) => <SkeletonCard key={MENU_GRID_SKELETON_KEYS[idx]} />)
          : filteredProducts.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                onQuickView={setSelectedProduct}
                reviewAverage={reviewSummaries[item.id]?.average}
                reviewCount={reviewSummaries[item.id]?.count}
              />
            ))}
      </div>
      {!loading && !error && !visibleCategories.length ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/80">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">No categories</p>
          <p className="mt-2 text-sm text-slate-500">The menu has no active categories right now.</p>
        </div>
      ) : null}
      {!loading && !error && !visibleProducts.length ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/80">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">No products</p>
          <p className="mt-2 text-sm text-slate-500">Check back soon — we&apos;re updating the menu.</p>
        </div>
      ) : null}
      {!loading && !error && visibleProducts.length > 0 && visibleCategories.length > 0 && filteredProducts.length === 0 ? (
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
        <MenuPageInner />
      </Suspense>
    </>
  );
}
