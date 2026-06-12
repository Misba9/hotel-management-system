"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type GlassCardProps = Omit<HTMLAttributes<HTMLDivElement>, keyof HTMLMotionProps<"div">> &
  HTMLMotionProps<"div"> & {
    hover?: boolean;
    glow?: boolean;
    delay?: number;
  };

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover = false, glow = false, delay = 0, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-surface-raised/70 p-5 shadow-glass backdrop-blur-xl",
        hover && "transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-primary/20 hover:shadow-glow-sm",
        glow && "shadow-glow",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
);
GlassCard.displayName = "GlassCard";
