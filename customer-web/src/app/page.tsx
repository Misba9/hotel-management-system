"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeroSection } from "@/components/home/hero-section";
import dynamic from "next/dynamic";
import { ProductCard } from "@/components/menu/product-card";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { Product, getMenuPayload } from "@/lib/menu-data";
import { fetchReviewSummaries, type ReviewSummary } from "@/lib/reviews-client";

const CategorySlider = dynamic(() => import("@/components/home/category-slider").then((mod) => mod.CategorySlider));
const PromoBanners = dynamic(() => import("@/components/home/promo-banners").then((mod) => mod.PromoBanners));
const WhyChooseUs = dynamic(() => import("@/components/home/why-choose-us").then((mod) => mod.WhyChooseUs));
const ReviewCarousel = dynamic(() => import("@/components/home/review-carousel").then((mod) => mod.ReviewCarousel));
const ProductQuickViewModal = dynamic(
  () => import("@/components/menu/product-quick-view-modal").then((mod) => mod.ProductQuickViewModal),
  { ssr: false }
);

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [reviewSummaries, setReviewSummaries] = useState<Record<string, ReviewSummary>>({});

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setError(null);
      try {
        const payload = await getMenuPayload();
        setProducts(payload.products);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load products.");
      } finally {
        setLoading(false);
      }
    }

    void loadProducts();
  }, []);

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
            ? Array.from({ length: 8 }).map((_, index) => <SkeletonCard key={`all-skel-${index}`} />)
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
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Featured Juices</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
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
            ? Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
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
