"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Product, getMenuPayload } from "@/lib/menu-data";
import { useCart } from "@/components/providers/cart-provider";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState(1);
  const [qty, setQty] = useState(1);

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
    <section className="grid gap-6 md:grid-cols-2">
      <div className="relative h-72 overflow-hidden rounded-3xl border bg-white shadow-lg sm:h-[420px] dark:border-slate-700 dark:bg-slate-900">
        <Image src={product.image} alt={product.name} fill className="object-cover" priority />
      </div>
      <div className="space-y-5">
        <div>
          <p className="mb-2 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            {product.categoryName}
          </p>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">{product.description}</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-semibold">Ingredients</h2>
          <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
            {product.ingredients.map((ingredient) => (
              <li key={ingredient}>{ingredient}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-semibold">Select size</h2>
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

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-2 py-1 dark:bg-slate-800">
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
          onClick={() => {
            const pricedProduct = { ...product, price: calculatedPrice };
            for (let i = 0; i < qty; i += 1) addItem(pricedProduct);
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white"
        >
          <ShoppingBag className="h-4 w-4" />
          Add to cart
        </button>
      </div>
    </section>
  );
}
