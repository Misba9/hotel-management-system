"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";
import { reviews } from "@/lib/catalog";

export function ReviewCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % reviews.length);
    }, 2800);
    return () => window.clearInterval(interval);
  }, []);

  const review = reviews[index];
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold">Customer Reviews</h2>
      <div className="rounded-2xl border bg-white p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-2 flex items-center gap-1">
              {Array.from({ length: review.rating }).map((_, i) => (
                <Star key={`${review.id}-star-${i}`} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-slate-700">&ldquo;{review.text}&rdquo;</p>
            <p className="mt-2 text-sm font-medium text-slate-500">- {review.name}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
