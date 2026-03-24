"use client";

import { motion } from "framer-motion";

type MenuCardProps = {
  name: string;
  category: string;
  price: number;
};

export function MenuCard({ name, category, price }: MenuCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="rounded-2xl border bg-white/80 p-4 shadow-glass backdrop-blur"
    >
      <p className="text-xs text-orange-600">{category}</p>
      <h3 className="mt-2 text-lg font-semibold">{name}</h3>
      <p className="mt-3 font-medium">Rs. {price}</p>
      <button className="mt-4 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white">
        Add to cart
      </button>
    </motion.div>
  );
}
