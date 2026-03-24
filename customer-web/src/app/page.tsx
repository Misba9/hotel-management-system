"use client";

import { useEffect, useState } from "react";
import { HeroSection } from "@/components/home/hero-section";
import dynamic from "next/dynamic";
import { ProductCard } from "@/components/menu/product-card";
import { SkeletonCard } from "@/components/shared/skeleton-card";
import { Product, getMenuPayload } from "@/lib/menu-data";

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

  const featured = products.filter((product) => product.featured);
  const popular = products.filter((product) => product.popular);

  return (
    <section className="space-y-10">
      <HeroSection />
      <CategorySlider />
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Featured Juices</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
            : featured.map((product) => <ProductCard key={product.id} product={product} onQuickView={setSelectedProduct} />)}
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
            : popular.map((product) => <ProductCard key={product.id} product={product} onQuickView={setSelectedProduct} />)}
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
        />
      ) : null}
    </section>
  );
}
