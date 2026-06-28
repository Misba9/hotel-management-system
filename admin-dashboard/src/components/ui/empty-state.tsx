"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-theme-border bg-theme-card px-6 py-16 text-center shadow-card",
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-theme-border bg-brand-muted">
        <Icon className="h-6 w-6 text-brand-primary" />
      </div>
      <h3 className="text-base font-semibold text-theme-text-primary">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-sm text-theme-text-secondary">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
