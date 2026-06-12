"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionHeader } from "@/components/ui/section-header";

const insights = [
  { emoji: "🔥", text: "Chicken stock will finish in 3 hours", type: "warning" as const },
  { emoji: "📈", text: "Saturday demand expected +22%", type: "positive" as const },
  { emoji: "⚠", text: "Tomato wastage increased 18%", type: "warning" as const },
  { emoji: "💰", text: "Highest profit item today: Paneer Tikka", type: "positive" as const },
  { emoji: "⭐", text: "Recommend purchasing Cheese — 2 recipes affected", type: "info" as const }
];

const typeStyles = {
  warning: "border-amber-500/20 bg-amber-500/5",
  positive: "border-emerald-500/20 bg-emerald-500/5",
  info: "border-brand-primary/20 bg-brand-muted"
};

export function AiInsightsPanel() {
  return (
    <GlassCard>
      <SectionHeader
        title="AI Insights"
        description="Predictive intelligence for your operations"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-primary/30 bg-brand-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
            <Sparkles className="h-3 w-3" />
            Live
          </span>
        }
      />
      <div className="mt-4 space-y-2">
        {insights.map((insight, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`flex items-start gap-3 rounded-xl border p-3 ${typeStyles[insight.type]}`}
          >
            <span className="text-lg leading-none">{insight.emoji}</span>
            <p className="text-sm text-white/80">{insight.text}</p>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
}
