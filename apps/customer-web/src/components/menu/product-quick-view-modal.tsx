"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star, X } from "lucide-react";
import { Product } from "@/lib/menu-data";
import { useCart } from "@/components/providers/cart-provider";

type ProductQuickViewModalProps = {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProductQuickViewModal({ product, open, onOpenChange }: ProductQuickViewModalProps) {
  const { addItem } = useCart();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-4 shadow-2xl focus:outline-none dark:bg-slate-900 md:p-5">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
            <div className="mb-3 flex items-center justify-between">
              <Dialog.Title className="text-xl font-semibold">Product Details</Dialog.Title>
              <Dialog.Close asChild>
                <button aria-label="Close quick view" className="rounded-full border border-slate-200 p-2">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {product ? (
              <div className="space-y-4">
                <div className="relative h-56 w-full overflow-hidden rounded-2xl">
                  <Image src={product.image} alt={product.name} fill className="object-cover" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xl font-semibold">{product.name}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {product.rating}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{product.description}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-orange-600">Rs. {product.price}</p>
                  <div className="flex items-center gap-2">
                    <Link href={`/product/${product.id}`} className="rounded-xl border px-4 py-2 text-sm font-medium dark:border-slate-700">
                      View Details
                    </Link>
                    <button
                      onClick={() => {
                        addItem(product);
                        onOpenChange(false);
                      }}
                      className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
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
