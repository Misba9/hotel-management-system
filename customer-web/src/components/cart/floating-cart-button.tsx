"use client";

import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";

export function FloatingCartButton() {
  const { count, openCart } = useCart();
  if (count === 0) return null;

  return (
    <motion.button
      aria-label="Floating cart button"
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      whileTap={{ scale: 0.96 }}
      onClick={openCart}
      className="fixed bottom-24 right-4 z-40 hidden rounded-full bg-orange-500 p-4 text-white shadow-lg md:block md:bottom-6 dark:bg-orange-600"
    >
      <ShoppingBag className="h-5 w-5" />
      <span className="absolute -right-1 -top-1 rounded-full bg-black px-1.5 text-[10px]">{count}</span>
    </motion.button>
  );
}
