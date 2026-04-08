"use client";

import { Check } from "lucide-react";
import {
  ORDER_TRACKING_STEPS,
  isCancelledStatus,
  statusToCurrentStepIndex
} from "@/lib/order-tracking";

type Props = {
  status: string;
  className?: string;
};

/**
 * Horizontal progress: completed steps emerald, current orange, upcoming slate.
 */
export function OrderStatusStepperHorizontal({ status, className = "" }: Props) {
  const cancelled = isCancelledStatus(status);
  const delivered = status.toLowerCase().trim() === "delivered";
  const current = cancelled ? -1 : statusToCurrentStepIndex(status);

  if (cancelled) {
    return (
      <div
        className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 ${className}`.trim()}
      >
        This order was cancelled.
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`.trim()}>
      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-[560px] items-center sm:min-w-0">
          {ORDER_TRACKING_STEPS.map((step, index) => {
            const done = delivered ? true : index < current;
            const active = !delivered && index === current;

            return (
              <div key={step.key} className="flex min-w-0 flex-1 items-center">
                {index > 0 ? (
                  <div
                    className={`h-1 min-w-[6px] flex-1 rounded-full ${
                      delivered || current > index - 1 ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                    }`}
                    aria-hidden
                  />
                ) : null}
                <div className="flex shrink-0 flex-col items-center px-0.5">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors sm:h-10 sm:w-10 ${
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                        : active
                          ? "border-orange-500 bg-orange-500 text-white shadow-md ring-4 ring-orange-500/25 dark:ring-orange-400/20"
                          : "border-slate-200 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-900"
                    }`}
                    aria-current={active ? "step" : undefined}
                  >
                    {done ? (
                      <Check className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.5} aria-hidden />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <p
                    className={`mt-2 max-w-[4.75rem] text-center text-[10px] font-semibold leading-tight sm:max-w-[6rem] sm:text-xs ${
                      done || active ? "text-slate-900 dark:text-slate-50" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
