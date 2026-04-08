"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, Heart, Minus, Plus, Star } from "lucide-react";
import { memo } from "react";
import { Product } from "@/lib/menu-data";
import { useCart } from "@/components/cart/cart-provider";
import { useFavorites } from "@/components/providers/favorites-provider";

function ProductCardComponent({
  product,
  onQuickView,
  reviewAverage,
  reviewCount
}: {
  product: Product;
  onQuickView?: (product: Product) => void;
  reviewAverage?: number | null;
  reviewCount?: number | null;
}) {
  const { addItem, itemQty, updateQty } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const qty = itemQty(product.id);
  const hasReviewStats = reviewCount != null && reviewCount > 0 && reviewAverage != null;
  const ratingLabel = hasReviewStats ? reviewAverage.toFixed(1) : Number(product.rating).toFixed(1);

  return (
    <motion.article
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group overflow-hidden rounded-xl border border-white/50 bg-white/70 shadow-md backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg md:rounded-2xl md:hover:-translate-y-1"
    >
      <Link href={`/product/${product.id}`} className="relative block h-32 w-full sm:h-40 md:h-44 lg:h-48">
        <Image
          src={product.image}
          alt={product.name}
          fill
          loading="lazy"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-all duration-200 group-hover:scale-105"
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
      <div className="space-y-2 p-3 sm:space-y-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/product/${product.id}`}
            className="line-clamp-2 text-sm font-semibold hover:text-orange-600 sm:text-base lg:text-lg"
          >
            {product.name}
          </Link>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium tabular-nums dark:bg-amber-950/40">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {ratingLabel}
            {hasReviewStats ? <span className="font-normal opacity-75">({reviewCount})</span> : null}
          </span>
        </div>
        <p className="line-clamp-2 text-xs text-slate-600 sm:text-sm">{product.description}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-orange-600 sm:text-base">Rs. {product.price}</p>
          {qty === 0 ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => addItem(product)}
              className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-orange-500 px-3 py-2 text-sm font-medium text-white shadow-md transition-all duration-200 hover:bg-orange-600 hover:shadow-lg sm:w-auto sm:rounded-full sm:py-1.5"
            >
              <Plus className="h-4 w-4" />
              Add
            </motion.button>
          ) : (
            <div className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-50 px-2 py-1 sm:w-auto">
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
