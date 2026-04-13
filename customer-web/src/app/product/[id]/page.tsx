"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag, Star } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Product, getMenuPayload } from "@/lib/menu-data";
import { useCart } from "@/components/cart/cart-provider";
import { ProductReviewsSection } from "@/components/reviews/product-reviews-section";
import { SafeFillImage } from "@/components/shared/safe-fill-image";
import { fetchReviewSummaries, type ReviewSummary } from "@/lib/reviews-client";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState(1);
  const [qty, setQty] = useState(1);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);

  const refreshReviewSummary = useCallback(async (productId: string) => {
    const map = await fetchReviewSummaries([productId]);
    const s = map[productId];
    setReviewSummary(s && s.count > 0 ? s : null);
  }, []);

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      setError(null);
      try {
        const payload = await getMenuPayload();
        setProduct(payload.products.find((item) => item.id === params.id) ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load menu.");
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }

    void loadProduct();
  }, [params.id]);

  useEffect(() => {
    if (!params.id) return;
    void refreshReviewSummary(params.id);
  }, [params.id, refreshReviewSummary]);

  const calculatedPrice = useMemo(() => {
    if (!product) return 0;
    return Math.round(product.price * selectedSize);
  }, [product, selectedSize]);

  if (loading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Loading product...</h1>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Product not found</h1>
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}
        <Link href="/menu" className="text-orange-600 underline">
          Go back to menu
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden sm:space-y-8">
      <section className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2">
      <div className="relative h-56 w-full overflow-hidden rounded-xl border bg-white shadow-md transition-all duration-200 dark:border-slate-700 dark:bg-slate-900 sm:h-72 md:h-[420px] md:rounded-2xl hover:shadow-lg">
        <SafeFillImage
          src={product.image}
          alt={product.name}
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-all duration-200"
          priority
        />
      </div>
      <div className="min-w-0 space-y-4 sm:space-y-5">
        <div>
          <p className="mb-2 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            {product.categoryName}
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl">{product.name}</h1>
          {reviewSummary ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="tabular-nums">{reviewSummary.average.toFixed(1)}</span>
              <span className="font-normal text-slate-500 dark:text-slate-400">
                ({reviewSummary.count} review{reviewSummary.count === 1 ? "" : "s"})
              </span>
            </p>
          ) : null}
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 sm:text-base">{product.description}</p>
        </div>

        <div className="rounded-xl border bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:rounded-2xl sm:p-4">
          <h2 className="text-sm font-semibold sm:text-base">Ingredients</h2>
          <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
            {product.ingredients.map((ingredient) => (
              <li key={ingredient}>{ingredient}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:rounded-2xl sm:p-4">
          <h2 className="text-sm font-semibold sm:text-base">Select size</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.sizes.map((size) => {
              const active = selectedSize === size.multiplier;
              return (
                <button
                  key={size.label}
                  onClick={() => setSelectedSize(size.multiplier)}
                  className={`rounded-full px-4 py-2 text-sm ${
                    active
                      ? "bg-orange-500 text-white"
                      : "border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                  }`}
                >
                  {size.label} - Rs. {Math.round(product.price * size.multiplier)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-orange-50 px-2 py-1 dark:bg-slate-800">
            <button
              aria-label="Decrease quantity"
              onClick={() => setQty((prev) => Math.max(1, prev - 1))}
              className="rounded-full p-1 text-orange-600"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-6 text-center">{qty}</span>
            <button
              aria-label="Increase quantity"
              onClick={() => setQty((prev) => prev + 1)}
              className="rounded-full p-1 text-orange-600"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="font-semibold text-orange-600">Rs. {calculatedPrice * qty}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            const pricedProduct = { ...product, price: calculatedPrice };
            for (let i = 0; i < qty; i += 1) addItem(pricedProduct);
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-orange-600 hover:shadow-lg sm:w-auto sm:rounded-2xl sm:text-base"
        >
          <ShoppingBag className="h-4 w-4" />
          Add to cart
        </button>
      </div>
      </section>
      <ProductReviewsSection
        productId={product.id}
        onReviewsChanged={() => void refreshReviewSummary(product.id)}
      />
    </div>
  );
}
