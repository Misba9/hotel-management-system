"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Search, SlidersHorizontal, Star } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { getMenuPayload } from "@/lib/menu-data";
import type { Category, Product } from "@/lib/menu-data-types";
import { buildMenuUrl, filterMenuProducts } from "@/lib/menu-search";

const DEBOUNCE_MS = 280;
const DROPDOWN_MAX = 8;

export function NavbarMenuSearch() {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  const [categoryId, setCategoryId] = useState<string>("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [popularOnly, setPopularOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await getMenuPayload();
        if (!cancelled) {
          setProducts(payload.products);
          setCategories(payload.categories);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
          setCategories([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const minN = minPrice === "" ? null : Number(minPrice);
  const maxN = maxPrice === "" ? null : Number(maxPrice);

  const filtered = useMemo(() => {
    const noText = !debouncedQuery.trim();
    const noExtra = !categoryId && minN == null && maxN == null && !popularOnly;
    if (noText && noExtra) return [];

    return filterMenuProducts(products, {
      text: debouncedQuery,
      categoryId: categoryId || null,
      minPrice: minN != null && Number.isFinite(minN) ? minN : null,
      maxPrice: maxN != null && Number.isFinite(maxN) ? maxN : null,
      popularOnly
    });
  }, [products, debouncedQuery, categoryId, minN, maxN, popularOnly]);

  const preview = useMemo(() => filtered.slice(0, DROPDOWN_MAX), [filtered]);

  const hasQuery = query.trim().length > 0;
  const hasFilters = Boolean(categoryId) || minN != null || maxN != null || popularOnly;
  const showDropdown = open && !loading;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const menuHref = useMemo(
    () =>
      buildMenuUrl({
        q: debouncedQuery,
        category: categoryId || undefined,
        min: minN,
        max: maxN,
        popular: popularOnly
      }),
    [debouncedQuery, categoryId, minN, maxN, popularOnly]
  );

  const resetFilters = useCallback(() => {
    setCategoryId("");
    setMinPrice("");
    setMaxPrice("");
    setPopularOnly(false);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <div
        className={`flex items-center gap-2 rounded-full border bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur dark:bg-slate-900/90 ${
          open ? "border-orange-300 ring-2 ring-orange-500/20 dark:border-orange-800" : "border-slate-200 dark:border-slate-700"
        }`}
      >
        <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          autoComplete="off"
          placeholder="Search menu…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 sm:text-base"
          aria-label="Search products by name"
          aria-expanded={showDropdown}
          aria-controls="navbar-search-results"
        />
        <button
          type="button"
          onClick={() => {
            setShowFilters((v) => !v);
            setOpen(true);
          }}
          className={`shrink-0 rounded-full p-1.5 transition ${
            hasFilters ? "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          aria-label="Toggle filters"
          aria-expanded={showFilters}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden /> : null}
      </div>

      {showDropdown ? (
        <div
          id="navbar-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[min(70vh,420px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {showFilters ? (
            <div className="space-y-3 border-b border-slate-100 p-3 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Filters</p>
              <div>
                <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300">Category</label>
                <div className="relative">
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm dark:border-slate-600 dark:bg-slate-950"
                  >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300">Min ₹</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    placeholder="0"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300">Max ₹</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    placeholder="Any"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={popularOnly}
                  onChange={(e) => setPopularOnly(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <Star className="h-4 w-4 text-amber-500" aria-hidden />
                Popular items only
              </label>
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
              >
                Clear filters
              </button>
            </div>
          ) : null}

          <div className="max-h-[280px] overflow-y-auto p-2">
            {!hasQuery && !hasFilters && !showFilters ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Type a product name or open filters — results update after you pause typing.
              </p>
            ) : preview.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No matching items.</p>
            ) : (
              <ul className="space-y-1">
                {preview.map((p) => (
                  <li key={p.id} role="option">
                    <Link
                      href={`/product/${p.id}`}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 rounded-xl p-2 transition hover:bg-orange-50 dark:hover:bg-orange-950/30"
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                        <Image src={p.image} alt={p.name} fill sizes="48px" className="object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{p.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {p.categoryName}
                          {p.popular ? (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                              <Star className="h-3 w-3 fill-current" aria-hidden />
                              Popular
                            </span>
                          ) : null}
                        </p>
                        <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">Rs. {p.price}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-100 p-2 dark:border-slate-800">
            <Link
              href={filtered.length > 0 ? menuHref : "/menu"}
              onClick={() => setOpen(false)}
              className="block rounded-xl bg-orange-500 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              {filtered.length > 0
                ? `See all ${filtered.length} result${filtered.length === 1 ? "" : "s"} on menu`
                : "Browse full menu"}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
