"use client";

import { motion } from "framer-motion";
import { CartIconButton } from "@/components/cart/cart-icon-button";
import { useCart } from "@/components/cart/cart-provider";

export function FloatingCartButton() {
  const { count, openCart } = useCart();
  if (count === 0) return null;

  return (
    <motion.div
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      className="fixed bottom-24 right-4 z-40 hidden md:block md:bottom-6"
    >
      <CartIconButton
        count={count}
        onClick={openCart}
        aria-label="Open cart"
        className="rounded-full bg-orange-500 p-4 text-white shadow-lg transition active:scale-95 dark:bg-orange-600"
        iconClassName="h-5 w-5"
        badgeClassName="absolute -right-1 -top-1 rounded-full bg-black px-1.5 text-[10px] font-medium text-white"
      />
    </motion.div>
  );
}
