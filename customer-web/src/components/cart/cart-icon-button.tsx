"use client";

import { ShoppingBag } from "lucide-react";

type CartIconButtonProps = {
  count: number;
  onClick: () => void;
  /** e.g. navbar: bordered icon; FAB: filled orange circle */
  className?: string;
  iconClassName?: string;
  badgeClassName?: string;
  "aria-label"?: string;
};

function formatBadge(n: number): string {
  if (n <= 0) return "";
  if (n > 99) return "99+";
  return String(n);
}

/**
 * Reusable cart trigger: bag icon + optional quantity badge.
 */
export function CartIconButton({
  count,
  onClick,
  className = "",
  iconClassName = "h-4 w-4",
  badgeClassName = "",
  "aria-label": ariaLabel
}: CartIconButtonProps) {
  const label =
    ariaLabel ?? (count > 0 ? `Open cart, ${count} items` : "Open cart");

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center ${className}`.trim()}
    >
      <ShoppingBag className={iconClassName} />
      {count > 0 ? (
        <span
          className={
            badgeClassName ||
            "absolute -right-1 -top-1 min-w-[1.125rem] rounded-full bg-orange-500 px-1 text-center text-[10px] font-semibold leading-tight text-white"
          }
        >
          {formatBadge(count)}
        </span>
      ) : null}
    </button>
  );
}
