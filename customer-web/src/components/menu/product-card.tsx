"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, Heart, Minus, Plus, Star } from "lucide-react";
import { memo } from "react";
import { Product } from "@/lib/menu-data";
import { useCart } from "@/components/providers/cart-provider";
import { useFavorites } from "@/components/providers/favorites-provider";

function ProductCardComponent({
  product,
  onQuickView
}: {
  product: Product;
  onQuickView?: (product: Product) => void;
}) {
  const { addItem, itemQty, updateQty } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const qty = itemQty(product.id);

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      className="group overflow-hidden rounded-3xl border border-white/50 bg-white/70 shadow-md backdrop-blur transition hover:-translate-y-1 hover:shadow-xl"
    >
      <Link href={`/product/${product.id}`} className="relative block h-44 w-full">
        <Image
          src={product.image}
          alt={product.name}
          fill
          loading="lazy"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition group-hover:scale-105"
        />
        <button
          aria-label="Toggle favorite"
          onClick={() => toggleFavorite(product.id)}
          className="absolute right-3 top-3 rounded-full bg-white/90 p-2"
        >
          <Heart className={`h-4 w-4 ${isFavorite(product.id) ? "fill-red-500 text-red-500" : "text-slate-600"}`} />
        </button>
        {onQuickView && (
          <button
            aria-label={`Quick view ${product.name}`}
            onClick={() => onQuickView(product)}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-white"
          >
            <Eye className="h-3.5 w-3.5" />
            Quick View
          </button>
        )}
      </Link>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/product/${product.id}`} className="font-semibold hover:text-orange-600">
            {product.name}
          </Link>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {product.rating}
          </span>
        </div>
        <p className="text-sm text-slate-600">{product.description}</p>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-orange-600">Rs. {product.price}</p>
          {qty === 0 ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => addItem(product)}
              className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1.5 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Add
            </motion.button>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-2 py-1">
              <button
                aria-label="Decrease quantity"
                onClick={() => updateQty(product.id, qty - 1)}
                className="rounded-full p-1 text-orange-600"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-4 text-center text-sm font-semibold text-orange-700">{qty}</span>
              <button
                aria-label="Increase quantity"
                onClick={() => updateQty(product.id, qty + 1)}
                className="rounded-full p-1 text-orange-600"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export const ProductCard = memo(ProductCardComponent);
