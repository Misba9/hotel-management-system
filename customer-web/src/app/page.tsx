"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeroSection } from "@/components/home/hero-section";
import dynamic from "next/dynamic";
import { ProductCard } from "@/components/menu/product-card";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import type { Product } from "@/lib/menu-data";
import { fetchReviewSummaries, type ReviewSummary } from "@/lib/reviews-client";

const CategorySlider = dynamic(() => import("@/components/home/category-slider").then((mod) => mod.CategorySlider));
const PromoBanners = dynamic(() => import("@/components/home/promo-banners").then((mod) => mod.PromoBanners));
const WhyChooseUs = dynamic(() => import("@/components/home/why-choose-us").then((mod) => mod.WhyChooseUs));
const ReviewCarousel = dynamic(() => import("@/components/home/review-carousel").then((mod) => mod.ReviewCarousel));
const ProductQuickViewModal = dynamic(
  () => import("@/components/menu/product-quick-view-modal").then((mod) => mod.ProductQuickViewModal),
  { ssr: false }
);

/** Stable keys for static skeleton grids (avoid raw index-only keys). */
const SKEL_KEYS_8 = ["hg1", "hg2", "hg3", "hg4", "hg5", "hg6", "hg7", "hg8"] as const;
const SKEL_KEYS_4A = ["hf1", "hf2", "hf3", "hf4"] as const;
const SKEL_KEYS_4B = ["hp1", "hp2", "hp3", "hp4"] as const;

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [reviewSummaries, setReviewSummaries] = useState<Record<string, ReviewSummary>>({});

  async function loadProductsPage(cursor?: string | null) {
    const qp = new URLSearchParams();
    qp.set("limit", "24");
    if (cursor) qp.set("cursor", cursor);
    const res = await fetch(`/api/products?${qp.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Products request failed (${res.status})`);
    const data = (await res.json()) as {
      products?: Product[];
      pageInfo?: { hasMore?: boolean; nextCursor?: string | null };
    };
    return {
      products: Array.isArray(data.products) ? data.products : [],
      hasMore: Boolean(data.pageInfo?.hasMore),
      nextCursor: data.pageInfo?.nextCursor ?? null
    };
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const page = await loadProductsPage(null);
        if (cancelled) return;
        setProducts(page.products);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load products.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMoreProducts() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await loadProductsPage(nextCursor);
      setProducts((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        for (const p of page.products) byId.set(p.id, p);
        return [...byId.values()];
      });
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more products.");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (products.length === 0) {
      setReviewSummaries({});
      return;
    }
    const ids = products.map((p) => p.id);
    void fetchReviewSummaries(ids).then(setReviewSummaries);
  }, [products]);

  const featured = products.filter((product) => product.featured);
  const popular = products.filter((product) => product.popular);

  return (
    <section className="space-y-10">
      <HeroSection />
      <CategorySlider />
      <section className="space-y-4" aria-labelledby="home-all-products-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="home-all-products-heading" className="text-2xl font-semibold sm:text-3xl">
              All products
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Full menu — tap a card for details or add to cart.
            </p>
          </div>
          <Link
            href="/menu"
            className="shrink-0 text-sm font-semibold text-orange-600 underline-offset-2 hover:underline dark:text-orange-400"
          >
            Open menu with filters
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, index) => <SkeletonCard key={SKEL_KEYS_8[index]} />)
            : products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onQuickView={setSelectedProduct}
                  reviewAverage={reviewSummaries[product.id]?.average}
                  reviewCount={reviewSummaries[product.id]?.count}
                />
              ))}
        </div>
        {!loading && !error && products.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
            No products yet. Check back soon.
          </p>
        ) : null}
        {!loading && products.length > 0 && hasMore ? (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => void loadMoreProducts()}
              disabled={loadingMore}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              {loadingMore ? "Loading..." : "Load more products"}
            </button>
          </div>
        ) : null}
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Featured Juices</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={SKEL_KEYS_4A[index]} />)
            : featured.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onQuickView={setSelectedProduct}
                  reviewAverage={reviewSummaries[product.id]?.average}
                  reviewCount={reviewSummaries[product.id]?.count}
                />
              ))}
        </div>
      </section>
      {!loading && error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      <PromoBanners />
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Popular Items</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={SKEL_KEYS_4B[index]} />)
            : popular.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onQuickView={setSelectedProduct}
                  reviewAverage={reviewSummaries[product.id]?.average}
                  reviewCount={reviewSummaries[product.id]?.count}
                />
              ))}
        </div>
      </section>
      <WhyChooseUs />
      <ReviewCarousel />
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
