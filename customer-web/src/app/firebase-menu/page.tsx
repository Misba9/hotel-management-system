"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/cart/cart-provider";
import { SafeFillImage } from "@/components/shared/safe-fill-image";
import type { Product } from "@/lib/menu-data-types";

type ApiProduct = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName: string;
  description?: string;
  available?: boolean;
  image?: string;
};

type ApiCategory = {
  id: string;
  name: string;
  active?: boolean;
  sortOrder?: number;
};

type ApiResponse = {
  ok: boolean;
  menu?: {
    products?: ApiProduct[];
    categories?: ApiCategory[];
  };
  error?: string;
};

type CategoryTab = {
  id: string;
  name: string;
  count: number;
};

const PLACEHOLDER_IMAGE =
  "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200";

function apiProductToProduct(p: ApiProduct): Product {
  const image = p.image?.trim() ? p.image : PLACEHOLDER_IMAGE;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    categoryId: p.categoryId,
    categoryName: p.categoryName,
    price: p.price,
    rating: 4.5,
    image,
    ingredients: [],
    sizes: [{ label: "Medium", multiplier: 1 }],
    available: p.available !== false
  };
}

const MenuProductCard = memo(function MenuProductCard({ product }: { product: ApiProduct }) {
  const { addItem, itemQty, updateQty } = useCart();
  const full = apiProductToProduct(product);
  const qty = itemQty(product.id);
  const imageUrl = full.image;
  const disabled = product.available === false;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <Link href={`/product/${product.id}`} className="relative block aspect-[4/3] w-full overflow-hidden">
        <SafeFillImage
          src={imageUrl}
          alt={product.name}
          sizes="(max-width: 1024px) 50vw, 25vw"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        {product.categoryName ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            {product.categoryName}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-3.5">
        <div className="min-h-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-50">
            {product.name}
          </h3>
          <p className="mt-1 text-base font-semibold tabular-nums text-orange-600 dark:text-orange-400">
            Rs. {product.price}
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          {disabled ? (
            <p className="text-center text-xs font-medium text-slate-400 dark:text-slate-500">Unavailable</p>
          ) : qty === 0 ? (
            <button
              type="button"
              onClick={() => addItem(full)}
              className="w-full rounded-xl bg-orange-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.98] dark:bg-orange-500 dark:hover:bg-orange-400"
            >
              Add to Cart
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-orange-50 px-2 py-1.5 dark:bg-orange-950/50">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => updateQty(product.id, qty - 1)}
                className="rounded-lg p-2 text-orange-700 transition hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900/40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[2ch] text-center text-sm font-semibold text-orange-800 dark:text-orange-200">
                {qty}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => addItem(full)}
                className="rounded-lg p-2 text-orange-700 transition hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900/40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
});

const tabBase =
  "shrink-0 rounded-full px-4 py-2 text-sm font-medium shadow-sm outline-none transition-[transform,background-color,border-color,box-shadow,color] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-orange-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-background dark:focus-visible:ring-offset-slate-950";
const tabActive = "scale-[1.02] bg-orange-500 text-white shadow-md shadow-orange-500/30 ring-2 ring-orange-300/60 dark:ring-orange-400/40";
const tabInactive =
  "border border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/90 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-orange-800 dark:hover:bg-slate-800/80";

function CategoryTabList({
  categories,
  activeCategory,
  onSelect,
  productsCount
}: {
  categories: CategoryTab[];
  activeCategory: string;
  onSelect: (id: string) => void;
  productsCount: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useLayoutEffect(() => {
    const el = tabRefs.current.get(activeCategory);
    el?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      inline: "center",
      block: "nearest"
    });
  }, [activeCategory, prefersReducedMotion, categories]);

  return (
    <div
      className="no-scrollbar flex gap-2 overflow-x-auto scroll-smooth pb-1 [-webkit-overflow-scrolling:touch]"
      role="tablist"
      aria-label="Menu categories"
    >
      <button
        ref={(el) => {
          const m = tabRefs.current;
          if (el) m.set("all", el);
          else m.delete("all");
        }}
        type="button"
        role="tab"
        aria-selected={activeCategory === "all"}
        onClick={() => onSelect("all")}
        className={`${tabBase} whitespace-nowrap ${activeCategory === "all" ? tabActive : tabInactive}`}
      >
        All
        {productsCount > 0 ? <span className="ml-1.5 tabular-nums opacity-90">({productsCount})</span> : null}
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          ref={(el) => {
            const m = tabRefs.current;
            if (el) m.set(c.id, el);
            else m.delete(c.id);
          }}
          type="button"
          role="tab"
          aria-selected={activeCategory === c.id}
          onClick={() => onSelect(c.id)}
          className={`${tabBase} whitespace-nowrap ${activeCategory === c.id ? tabActive : tabInactive}`}
        >
          {c.name}
          {c.count > 0 ? <span className="ml-1.5 tabular-nums opacity-90">({c.count})</span> : null}
        </button>
      ))}
    </div>
  );
}

const CATEGORY_TAB_SKELETON_KEYS = ["fb-c1", "fb-c2", "fb-c3", "fb-c4", "fb-c5"] as const;
const PRODUCT_GRID_SKELETON_KEYS = ["fb-p1", "fb-p2", "fb-p3", "fb-p4", "fb-p5", "fb-p6", "fb-p7", "fb-p8"] as const;

function CategorySkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden pb-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={CATEGORY_TAB_SKELETON_KEYS[i]}
          className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700"
        />
      ))}
    </div>
  );
}

function ProductSkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="aspect-[4/3] w-full animate-pulse bg-slate-200 dark:bg-slate-800" />
      <div className="space-y-3 p-3 sm:p-3.5">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-5 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export default function FirebaseMenuPage() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<CategoryTab[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const selectCategory = useCallback((id: string) => {
    setActiveCategory(id);
  }, []);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/test/firebase-menu?limit=50", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) {
        throw new Error(json.error || "Failed to load menu.");
      }
      const apiProducts = json.menu?.products ?? [];
      const apiCategories = json.menu?.categories ?? [];

      const counts = apiProducts.reduce<Record<string, number>>((acc, p) => {
        if (!p.categoryId) return acc;
        acc[p.categoryId] = (acc[p.categoryId] || 0) + 1;
        return acc;
      }, {});

      const mappedCategories: CategoryTab[] = apiCategories
        .filter((c) => c.active !== false)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((c) => ({
          id: c.id,
          name: c.name,
          count: counts[c.id] || 0
        }));

      setProducts(apiProducts);
      setCategories(mappedCategories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load menu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === "all") return products;
    return products.filter((p) => p.categoryId === activeCategory);
  }, [products, activeCategory]);

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-7xl flex-col pb-10 pt-4 sm:pt-6">
      <header className="mb-5 sm:mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
          Menu
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Browse by category — from Firestore via <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">/api/test/firebase-menu</code>
        </p>
      </header>

      <div className="sticky top-16 z-20 -mx-4 border-b border-slate-100 bg-brand-background/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:top-20">
        {loading ? (
          <CategorySkeleton />
        ) : (
          <CategoryTabList
            categories={categories}
            activeCategory={activeCategory}
            onSelect={selectCategory}
            productsCount={products.length}
          />
        )}
      </div>

      {!loading && error ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadMenu()}
            className="self-start rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && products.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/80">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">No menu items yet</p>
          <p className="mt-2 text-sm text-slate-500">Add products in Firestore or check your Firebase configuration.</p>
        </div>
      ) : null}

      {!loading && !error && products.length > 0 && filteredProducts.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white/80 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/80">
          <p className="font-medium text-slate-800 dark:text-slate-100">Nothing in this category</p>
          <p className="mt-1 text-sm text-slate-500">Try another category.</p>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <ProductSkeletonCard key={PRODUCT_GRID_SKELETON_KEYS[idx]} />
          ))}
        </div>
      ) : (
        <motion.div
          key={activeCategory}
          className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {filteredProducts.map((product) => (
            <MenuProductCard key={product.id} product={product} />
          ))}
        </motion.div>
      )}
    </section>
  );
}
