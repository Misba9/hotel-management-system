"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";

function formatBadge(n: number): string {
  if (n <= 99) return String(n);
  return "99+";
}

/**
 * Global floating cart control — bottom-right, above mobile tab bar.
 * Opens the cart drawer and shows line count + estimated total (incl. delivery).
 */
export function FloatingCartButton() {
  const [isMounted, setIsMounted] = useState(false);
  const { count, grandTotal, openCart } = useCart();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div>
      {isMounted && count > 0 ? (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6"
        >
          <button
            type="button"
            onClick={openCart}
            aria-label={`Open cart, ${count} items, Rs. ${grandTotal} total`}
            className="flex items-center gap-3 rounded-full bg-orange-500 py-3 pl-4 pr-5 text-white shadow-lg shadow-orange-500/30 transition active:scale-[0.98] dark:bg-orange-600"
          >
            <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <ShoppingBag className="h-5 w-5" aria-hidden />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[10px] font-bold leading-none">
                {formatBadge(count)}
              </span>
            </span>
            <span className="text-left text-sm font-semibold tabular-nums">
              <span className="block text-[10px] font-medium uppercase tracking-wide text-white/90">Total</span>
              Rs. {grandTotal}
            </span>
          </button>
        </motion.div>
      ) : null}
    </div>
  );
}
