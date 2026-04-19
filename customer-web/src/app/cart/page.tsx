"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { ProductCard } from "@/components/menu/product-card";
import { SafeFillImage } from "@/components/shared/safe-fill-image";
import { ProductQuickViewModal } from "@/components/menu/product-quick-view-modal";
import { useCart } from "@/components/cart/cart-provider";
import { Product, getMenuPayload } from "@/lib/menu-data";
import { fetchReviewSummaries, type ReviewSummary } from "@/lib/reviews-client";
import { useEffect, useState } from "react";

const PLACEHOLDER_IMAGE =
  "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800";

type UpsellResponse = {
  itemIds?: string[];
  recommendations?: string[];
  products?: Array<{ id?: string }>;
  suggestions?: Array<{ productId?: string; id?: string }>;
};

export default function CartPage() {
  const { items, subtotal, total, discount, deliveryFee, grandTotal, updateQty, removeItem, openCart } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [reviewSummaries, setReviewSummaries] = useState<Record<string, ReviewSummary>>({});

  useEffect(() => {
    async function loadRecommendations() {
      setLoadingRecommendations(true);
      setRecommendationsError(null);
      try {
        const payload = await getMenuPayload();
        const productById = new Map(payload.products.map((product) => [product.id, product] as const));
        const cartItemIds = items.map((item) => item.productId);
        let recommended: Product[] = [];

        if (cartItemIds.length > 0) {
          try {
            const upsellRes = await fetch("/api/upsell", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itemIds: cartItemIds })
            });
            const upsellData = (await upsellRes.json()) as UpsellResponse;
            const recommendedIds = [
              ...((Array.isArray(upsellData.itemIds) ? upsellData.itemIds : []) as string[]),
              ...((Array.isArray(upsellData.recommendations) ? upsellData.recommendations : []) as string[]),
              ...((Array.isArray(upsellData.products) ? upsellData.products.map((entry) => String(entry.id ?? "")) : []) as string[]),
              ...((Array.isArray(upsellData.suggestions)
                ? upsellData.suggestions.map((entry) => String(entry.productId ?? entry.id ?? ""))
                : []) as string[])
            ].filter((id) => Boolean(id));
            recommended = recommendedIds
              .map((id) => productById.get(id))
              .filter((product): product is Product => Boolean(product))
              .filter((product) => !cartItemIds.includes(product.id))
              .slice(0, 3);
          } catch {
            /* upsell optional */
          }
        }

        if (recommended.length === 0) {
          recommended = payload.products
            .filter((item) => (item.popular || item.featured) && !cartItemIds.includes(item.id))
            .slice(0, 3);
        }
        setRecommendations(recommended);
      } catch (loadError) {
        setRecommendationsError(loadError instanceof Error ? loadError.message : "Failed to load menu.");
        setRecommendations([]);
      } finally {
        setLoadingRecommendations(false);
      }
    }

    void loadRecommendations();
  }, [items]);

  useEffect(() => {
    if (recommendations.length === 0) {
      setReviewSummaries({});
      return;
    }
    void fetchReviewSummaries(recommendations.map((r) => r.id)).then(setReviewSummaries);
  }, [recommendations]);

  return (
    <section className="space-y-6 pb-8 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl lg:text-4xl">
            Your cart
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {items.length === 0 ? "Add items from the menu." : `${items.length} product line${items.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={openCart}
            className="w-full text-sm font-medium text-orange-600 underline-offset-2 hover:underline dark:text-orange-400 sm:w-auto"
          >
            Quick view (drawer)
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/80">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">Your cart is empty</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Browse the menu and tap Add on anything you like.</p>
          <Link
            href="/menu"
            className="mt-6 inline-flex rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
          >
            Browse menu
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:gap-8">
          <ul className="space-y-3">
            {items.map((item) => {
              const src = item.image?.trim() ? item.image : PLACEHOLDER_IMAGE;
              const lineTotal = item.price * item.quantity;
              return (
                <li
                  key={item.productId}
                  className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                    <SafeFillImage src={src} alt={item.name} sizes="96px" className="object-cover" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-50">{item.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Rs. {item.price} each</p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => removeItem(item.productId)}
                        className="rounded-full p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => updateQty(item.productId, item.quantity - 1)}
                          className="rounded-full p-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => updateQty(item.productId, item.quantity + 1)}
                          className="rounded-full p-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-orange-600 dark:text-orange-400">Rs. {lineTotal}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-md transition-all duration-200 dark:border-slate-700 dark:bg-slate-900 sm:rounded-2xl sm:p-5 md:sticky md:top-28 hover:shadow-lg">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Subtotal</span>
                <span className="tabular-nums">Rs. {subtotal}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Discount</span>
                <span className="tabular-nums">-Rs. {discount}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Delivery fee</span>
                <span className="tabular-nums">Rs. {deliveryFee}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
                <span>Total</span>
                <span className="tabular-nums text-orange-600 dark:text-orange-400">Rs. {grandTotal}</span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                After discount: Rs. {total}. Estimated delivery fee included in total.
              </p>
            </div>
            <Link
              href="/checkout"
              className="block w-full rounded-xl bg-orange-500 py-3 text-center text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-orange-600 hover:shadow-lg"
            >
              Proceed to checkout
            </Link>
          </aside>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Recommended for you</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
          {loadingRecommendations ? <p className="text-sm text-slate-500">Loading recommendations…</p> : null}
          {!loadingRecommendations && recommendationsError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{recommendationsError}</p>
          ) : null}
          {!loadingRecommendations && !recommendationsError && recommendations.length === 0 ? (
            <p className="rounded-xl border bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900">
              No recommendations available right now.
            </p>
          ) : null}
          {recommendations.map((item) => (
            <ProductCard
              key={item.id}
              product={item}
              onQuickView={setSelectedProduct}
              reviewAverage={reviewSummaries[item.id]?.average}
              reviewCount={reviewSummaries[item.id]?.count}
            />
          ))}
        </div>
      </section>
      <ProductQuickViewModal
        product={selectedProduct}
        open={Boolean(selectedProduct)}
        onOpenChange={(open) => {
          if (!open) setSelectedProduct(null);
        }}
        reviewAverage={selectedProduct ? reviewSummaries[selectedProduct.id]?.average : undefined}
        reviewCount={selectedProduct ? reviewSummaries[selectedProduct.id]?.count : undefined}
      />
    </section>
  );
}
