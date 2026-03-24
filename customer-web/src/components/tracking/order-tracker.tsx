"use client";

import { motion } from "framer-motion";

const labels = ["Order placed", "Preparing", "Ready", "Out for delivery", "Delivered"];

export function OrderTracker({ activeStep }: { activeStep: number }) {
  return (
    <div className="space-y-4">
      {labels.map((label, index) => {
        const active = index <= activeStep;
        return (
          <div key={label} className="flex items-center gap-3">
            <div className="relative">
              <motion.div
                animate={{ scale: active ? 1 : 0.92 }}
                className={`h-4 w-4 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`}
              />
              {index < labels.length - 1 ? (
                <span className={`absolute left-1.5 top-4 h-7 w-[2px] ${index < activeStep ? "bg-emerald-400" : "bg-slate-200"}`} />
              ) : null}
            </div>
            <p className={active ? "font-medium" : "text-slate-500"}>{label}</p>
          </div>
        );
      })}
    </div>
  );
}
