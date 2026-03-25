"use client";

import Link from "next/link";
import { ProductCard } from "@/components/menu/product-card";
import { ProductQuickViewModal } from "@/components/menu/product-quick-view-modal";
import { useCart } from "@/components/providers/cart-provider";
import { Product, getMenuPayload } from "@/lib/menu-data";
import { useEffect, useState } from "react";

type UpsellResponse =
  | { itemIds?: string[]; recommendations?: string[]; products?: Array<{ id?: string }> }
  | { suggestions?: Array<{ productId?: string; id?: string }>; itemIds?: string[] };

export default function CartPage() {
  const { items, subtotal, total, discount, openCart } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const deliveryFee = items.length > 0 ? 40 : 0;

  useEffect(() => {
    async function loadRecommendations() {
      setLoadingRecommendations(true);
      setRecommendationsError(null);
      try {
        const payload = await getMenuPayload();
        const productById = new Map(payload.products.map((product) => [product.id, product] as const));
        const cartItemIds = items.map((item) => item.id);
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
            // If upsell service is unavailable, use catalog-based suggestions.
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

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Cart</h1>
      <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-300">Current cart items: {items.length}</p>
        <div className="mt-3 grid gap-2 text-sm">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span>
                {item.name} x{item.qty}
              </span>
              <span>Rs. {item.qty * item.price}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1 text-sm">
          <p className="flex justify-between"><span>Subtotal</span><span>Rs. {subtotal}</span></p>
          <p className="flex justify-between"><span>Discount</span><span>-Rs. {discount}</span></p>
          <p className="flex justify-between"><span>Delivery</span><span>Rs. {deliveryFee}</span></p>
          <p className="flex justify-between font-semibold"><span>Total</span><span>Rs. {total + deliveryFee}</span></p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={openCart} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white">
            Open Slide Cart
          </button>
          <Link href="/checkout" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium">
            Proceed to Checkout
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Recommended for You</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {loadingRecommendations ? <p className="text-sm text-slate-500">Loading recommendations...</p> : null}
          {!loadingRecommendations && recommendationsError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {recommendationsError}
            </p>
          ) : null}
          {!loadingRecommendations && !recommendationsError && recommendations.length === 0 ? (
            <p className="rounded-xl border bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900">
              No recommendations available right now.
            </p>
          ) : null}
          {recommendations.map((item) => (
            <ProductCard key={item.id} product={item} onQuickView={setSelectedProduct} />
          ))}
        </div>
      </section>
      <ProductQuickViewModal
        product={selectedProduct}
        open={Boolean(selectedProduct)}
        onOpenChange={(open) => {
          if (!open) setSelectedProduct(null);
        }}
      />
    </section>
  );
}
