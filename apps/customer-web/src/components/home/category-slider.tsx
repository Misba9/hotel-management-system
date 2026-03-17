"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Category, getMenuPayload } from "@/lib/menu-data";

export function CategorySlider() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <section className="space-y-3">
      <h2 className="text-3xl font-semibold">Featured Categories</h2>
      <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto pb-1">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="min-w-[200px] snap-start rounded-2xl border bg-white p-3 text-sm text-slate-500">
                Loading...
              </div>
            ))
          : null}
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/menu?category=${category.id}`}
            className="min-w-[200px] snap-start overflow-hidden rounded-2xl border bg-white shadow-md transition-all hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl"
          >
            <div className="relative h-28 w-full">
              {category.image ? (
                <Image src={category.image} alt={category.name} fill className="object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-orange-50 text-sm font-medium text-orange-700">
                  {category.name}
                </div>
              )}
            </div>
            <div className="p-3">
              <h3 className="text-sm font-medium">{category.name}</h3>
              <p className="text-xs text-slate-500">{category.count} items</p>
            </div>
          </Link>
        ))}
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
