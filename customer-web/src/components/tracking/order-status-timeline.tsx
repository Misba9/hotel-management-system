"use client";

import { motion } from "framer-motion";
import { Check, Circle, Package, Store, Truck } from "lucide-react";
import { ORDER_TRACKING_STEPS, statusToCurrentStepIndex, isCancelledStatus } from "@/lib/order-tracking";

const icons = [Circle, Store, Package, Truck, Check] as const;

type OrderStatusTimelineProps = {
  status: string;
  className?: string;
};

export function OrderStatusTimeline({ status, className = "" }: OrderStatusTimelineProps) {
  const cancelled = isCancelledStatus(status);
  const current = cancelled ? -1 : statusToCurrentStepIndex(status);
  const delivered = status.toLowerCase().trim() === "delivered";

  return (
    <div className={`space-y-0 ${className}`.trim()}>
      {cancelled ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          This order was cancelled.
        </div>
      ) : null}
      <ol className="relative space-y-0">
        {ORDER_TRACKING_STEPS.map((step, index) => {
          const Icon = icons[index] ?? Circle;
          const done = !cancelled && (delivered ? true : index < current);
          const active = !cancelled && !delivered && index === current;

          return (
            <li key={step.key} className="relative flex gap-3 pb-8 last:pb-0">
              {index < ORDER_TRACKING_STEPS.length - 1 ? (
                <div
                  className={`absolute left-[18px] top-10 h-[calc(100%-0.5rem)] w-0.5 ${
                    !cancelled && (delivered || index < current) ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                  aria-hidden
                />
              ) : null}
              <div className="relative z-[1] flex shrink-0 flex-col items-center">
                <motion.div
                  initial={false}
                  animate={{ scale: active ? 1.06 : 1 }}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                    done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : active
                        ? "border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300"
                        : "border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} aria-hidden />
                </motion.div>
              </div>
              <div className="min-w-0 pt-0.5">
                <p
                  className={`text-sm font-semibold ${
                    done || active ? "text-slate-900 dark:text-slate-50" : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{step.description}</p>
                {active ? (
                  <p className="mt-1 text-xs font-medium text-orange-600 dark:text-orange-400">Current step</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
