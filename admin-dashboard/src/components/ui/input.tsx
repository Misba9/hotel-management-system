"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "theme-input flex h-10 w-full rounded-xl border border-theme-border bg-theme-input-bg px-3 py-2 text-sm text-theme-text-primary placeholder:text-theme-text-disabled",
        "transition-colors focus:border-theme-primary/40 focus:outline-none focus:ring-2 focus:ring-theme-primary/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "theme-input flex min-h-[80px] w-full rounded-xl border border-theme-border bg-theme-input-bg px-3 py-2 text-sm text-theme-text-primary placeholder:text-theme-text-disabled",
        "transition-colors focus:border-theme-primary/40 focus:outline-none focus:ring-2 focus:ring-theme-primary/20",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
