"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Category, getMenuPayload } from "@/lib/menu-data";
import { SafeFillImage } from "@/components/shared/safe-fill-image";

const CATEGORY_ROW_SKELETON_KEYS = ["cr1", "cr2", "cr3", "cr4", "cr5", "cr6", "cr7", "cr8"] as const;

export function CategorySlider() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  const setItemRef = useCallback((id: string, el: HTMLAnchorElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);

  useEffect(() => {
    async function loadCategories() {
      setLoading(true);
      setError(null);
      try {
        const payload = await getMenuPayload();
        setCategories(payload.categories);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load menu.");
      } finally {
        setLoading(false);
      }
    }

    void loadCategories();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const el = itemRefs.current.get(activeId);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId]);

  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold sm:text-3xl">Featured Categories</h2>

      <div className="relative -mx-4 sm:mx-0">
        <div
          className="pointer-events-none absolute left-0 top-0 z-[1] h-full w-10 bg-gradient-to-r from-brand-background to-transparent dark:from-[#0b1220]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 top-0 z-[1] h-full w-10 bg-gradient-to-l from-brand-background to-transparent dark:from-[#0b1220]"
          aria-hidden
        />

        <div
          className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 py-3"
          role="list"
          aria-label="Browse categories"
        >
          {loading
            ? Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={CATEGORY_ROW_SKELETON_KEYS[index]}
                  className="flex min-w-[70px] shrink-0 snap-start flex-col items-center"
                  aria-hidden
                >
                  <div className="h-14 w-14 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700 sm:h-16 sm:w-16" />
                  <div className="mt-2 h-3 w-12 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              ))
            : null}

          {!loading &&
            categories.map((category) => {
              const isActive = activeId === category.id;
              return (
                <Link
                  key={category.id}
                  ref={(el) => setItemRef(category.id, el)}
                  href={`/menu?category=${category.id}`}
                  role="listitem"
                  onClick={() => setActiveId(category.id)}
                  className={`group flex min-w-[70px] shrink-0 snap-start cursor-pointer flex-col items-center whitespace-nowrap transition-all duration-200 ${
                    isActive ? "scale-105 text-orange-600" : "text-slate-700 dark:text-slate-200"
                  } `}
                >
                  <span
                    className={`relative block h-14 w-14 shrink-0 overflow-hidden rounded-full shadow-sm transition-all duration-200 group-hover:shadow-md sm:h-16 sm:w-16 ${
                      isActive
                        ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-brand-background dark:ring-offset-[#0b1220]"
                        : ""
                    }`}
                  >
                    {category.image ? (
                      <SafeFillImage
                        src={category.image}
                        alt={category.name}
                        sizes="(max-width: 640px) 56px, 64px"
                        className="object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-orange-50 text-[10px] font-semibold text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
                        {category.name.slice(0, 2)}
                      </span>
                    )}
                  </span>
                  <span
                    className={`mt-1 max-w-[4.5rem] truncate text-center text-xs transition-colors sm:max-w-[5.5rem] sm:text-sm ${
                      isActive ? "font-semibold text-orange-600" : "font-medium text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {category.name}
                  </span>
                  {category.count > 0 ? (
                    <span className="mt-0.5 text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                      {category.count} items
                    </span>
                  ) : null}
                </Link>
              );
            })}
        </div>
      </div>

      {!loading && error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      {!loading && !error && categories.length === 0 ? (
        <p className="rounded-xl border bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900">
          No categories available right now.
        </p>
      ) : null}
    </section>
  );
}
