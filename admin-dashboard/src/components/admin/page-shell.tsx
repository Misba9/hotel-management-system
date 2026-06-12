"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type PageShellProps = {
  title: string;
  description?: string;
  badge?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function PageShell({ title, description, badge, action, children, className }: PageShellProps) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("space-y-6", className)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {badge ? (
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary">{badge}</p>
          ) : null}
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-sm text-white/45">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </motion.section>
  );
}
