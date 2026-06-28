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
  orange:
    "from-blue-500/15 to-blue-500/5 text-blue-600 border-blue-500/20 dark:from-brand-primary/20 dark:to-brand-primary/5 dark:text-brand-primary dark:border-brand-primary/20",
  emerald:
    "from-emerald-500/15 to-emerald-500/5 text-emerald-600 border-emerald-500/20 dark:from-emerald-500/20 dark:to-emerald-500/5 dark:text-emerald-400 dark:border-emerald-500/20",
  violet:
    "from-violet-500/15 to-violet-500/5 text-violet-600 border-violet-500/20 dark:from-violet-500/20 dark:to-violet-500/5 dark:text-violet-400 dark:border-violet-500/20",
  sky: "from-sky-500/15 to-sky-500/5 text-sky-600 border-sky-500/20 dark:from-sky-500/20 dark:to-sky-500/5 dark:text-sky-400 dark:border-sky-500/20",
  rose: "from-rose-500/15 to-rose-500/5 text-rose-600 border-rose-500/20 dark:from-rose-500/20 dark:to-rose-500/5 dark:text-rose-400 dark:border-rose-500/20",
  amber:
    "from-amber-500/15 to-amber-500/5 text-amber-600 border-amber-500/20 dark:from-amber-500/20 dark:to-amber-500/5 dark:text-amber-400 dark:border-amber-500/20"
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
      className="admin-metric-card group relative overflow-hidden"
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-theme-text-secondary">{title}</p>
          {loading ? (
            <div className="mt-3 h-8 w-24 skeleton-shimmer rounded-lg" />
          ) : (
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-theme-text-primary sm:text-3xl">
              {displayValue}
            </p>
          )}
          {hint && !loading ? <p className="mt-1 text-[11px] text-theme-text-secondary">{hint}</p> : null}
          {trend && !loading ? (
            <p
              className={cn(
                "mt-1.5 text-xs font-medium",
                trend.value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label ?? "vs yesterday"}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br transition-transform duration-200 group-hover:scale-105",
            accentStyles[accent]
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </motion.div>
  );
}
