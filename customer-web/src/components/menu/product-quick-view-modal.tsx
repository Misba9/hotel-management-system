"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { motion } from "framer-motion";
import { useCallback } from "react";
import { Star, X } from "lucide-react";
import { Product } from "@/lib/menu-data";
import { useCart } from "@/components/cart/cart-provider";
import { SafeFillImage } from "@/components/shared/safe-fill-image";

type ProductQuickViewModalProps = {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewAverage?: number | null;
  reviewCount?: number | null;
};

export function ProductQuickViewModal({
  product,
  open,
  onOpenChange,
  reviewAverage,
  reviewCount
}: ProductQuickViewModalProps) {
  const { addItem } = useCart();
  const hasReviewStats =
    Boolean(product) && reviewCount != null && reviewCount > 0 && typeof reviewAverage === "number";
  const ratingLabel = !product
    ? ""
    : hasReviewStats
      ? reviewAverage.toFixed(1)
      : Number(product.rating).toFixed(1);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      queueMicrotask(() => onOpenChange(next));
    },
    [onOpenChange]
  );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[min(90dvh,640px)] w-[95%] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-xl bg-white p-4 shadow-md transition-all duration-200 focus:outline-none dark:bg-slate-900 sm:w-full sm:p-5 md:max-w-xl hover:shadow-lg">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <Dialog.Title className="text-lg font-semibold sm:text-xl">Product Details</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  aria-label="Close quick view"
                  className="rounded-xl border border-slate-200 p-2 transition-all duration-200 hover:bg-slate-50 dark:border-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {product ? (
              <div className="space-y-4">
                <div className="relative h-40 w-full overflow-hidden rounded-xl sm:h-48 md:h-56 md:rounded-2xl">
                  <SafeFillImage
                    src={product.image}
                    alt={product.name}
                    sizes="(max-width: 640px) 95vw, 36rem"
                    className="object-cover transition-all duration-200"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <h3 className="text-lg font-semibold sm:text-xl">{product.name}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium tabular-nums dark:bg-amber-950/40">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {ratingLabel}
                      {hasReviewStats ? <span className="font-normal opacity-75">({reviewCount})</span> : null}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 md:text-base">{product.description}</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-base font-semibold text-orange-600 sm:text-lg">Rs. {product.price}</p>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <Link
                      href={`/product/${product.id}`}
                      className="flex w-full items-center justify-center rounded-xl border px-4 py-2.5 text-center text-sm font-medium transition-all duration-200 dark:border-slate-700 sm:w-auto"
                    >
                      View Details
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        addItem(product);
                        onOpenChange(false);
                      }}
                      className="w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-200 hover:bg-orange-600 hover:shadow-lg sm:w-auto"
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No product selected.</p>
            )}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
