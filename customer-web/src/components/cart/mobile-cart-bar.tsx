"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useCart } from "@/components/cart/cart-provider";

export function MobileCartBar() {
  const { count, total } = useCart();
  if (count === 0) return null;

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed bottom-16 left-3 right-3 z-40 rounded-2xl bg-slate-900 p-3 text-white shadow-lg md:hidden dark:bg-slate-800"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm">
          {count} Items | Rs. {total}
        </p>
        <Link href="/checkout" className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold">
          Checkout
        </Link>
      </div>
    </motion.div>
  );
}
