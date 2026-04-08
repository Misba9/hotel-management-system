import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400 p-6 text-white md:p-10">
      <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-emerald-200/30 blur-2xl" />

      <div className="relative grid items-center gap-8 md:grid-cols-2 md:gap-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="order-2 max-w-2xl space-y-5 md:order-1"
        >
          <span className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs">
            <Sparkles className="h-3 w-3" />
            Hyderabad&apos;s premium juice delivery
          </span>
          <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">Fresh Juices Delivered in 10 Minutes</h1>
          <p className="max-w-lg text-sm text-orange-50 md:text-base">
            Cold-pressed juices, smoothies, bowls and shakes made with 100% fresh fruits and zero preservatives.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/menu" className="rounded-2xl bg-white px-6 py-3 text-base font-semibold text-orange-600 shadow-md">
              Order Now
            </Link>
            <Link href="/menu" className="rounded-2xl border border-white/70 px-6 py-3 text-base font-semibold text-white">
              View Menu
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full bg-white/20 px-3 py-1">⭐ 4.9 Rating</span>
            <span className="rounded-full bg-white/20 px-3 py-1">⚡ 10 min delivery</span>
            <span className="rounded-full bg-white/20 px-3 py-1">🍓 100% fresh fruits</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="order-1 relative mx-auto w-full max-w-lg md:order-2"
        >
          <div className="relative aspect-[5/4] w-full overflow-hidden rounded-3xl border border-white/50 bg-white/10 shadow-2xl ring-2 ring-white/30 backdrop-blur-sm">
            <Image
              src="/images/hero-fruits.svg"
              alt="Fresh fruit juices, smoothies, and colorful fruit illustration"
              fill
              className="object-cover object-center"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              unoptimized
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-orange-900/25 via-transparent to-white/10" />
          </div>
          <p className="mt-3 text-center text-[11px] font-medium text-orange-100/90 md:text-xs">
            100% fresh — cold-pressed &amp; preservative-free
          </p>
        </motion.div>
      </div>
    </section>
  );
}
