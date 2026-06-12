"use client";

import { type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  trend?: { value: number; label?: string };
  accent?: "orange" | "emerald" | "violet" | "sky" | "rose" | "amber";
  loading?: boolean;
  delay?: number;
  formatAsCurrency?: boolean;
};

const accentStyles = {
  orange: "from-brand-primary/20 to-brand-primary/5 text-brand-primary border-brand-primary/20",
  emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20",
  violet: "from-violet-500/20 to-violet-500/5 text-violet-400 border-violet-500/20",
  sky: "from-sky-500/20 to-sky-500/5 text-sky-400 border-sky-500/20",
  rose: "from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/20",
  amber: "from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/20"
};

export function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  trend,
  accent = "orange",
  loading,
  delay = 0,
  formatAsCurrency
}: MetricCardProps) {
  const displayValue =
    typeof value === "number" ? (formatAsCurrency ? formatCurrency(value) : value.toLocaleString("en-IN")) : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-raised/70 p-5 shadow-glass backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-primary/20 hover:shadow-glow-sm"
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-40 blur-2xl transition-opacity group-hover:opacity-70" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{title}</p>
          {loading ? (
            <div className="mt-3 h-8 w-24 skeleton-shimmer rounded-lg" />
          ) : (
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">{displayValue}</p>
          )}
          {hint && !loading ? <p className="mt-1 text-[11px] text-white/40">{hint}</p> : null}
          {trend && !loading ? (
            <p className={cn("mt-1.5 text-xs font-medium", trend.value >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label ?? "vs yesterday"}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br shadow-premium transition-transform duration-300 group-hover:scale-110",
            accentStyles[accent]
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </motion.div>
  );
}
