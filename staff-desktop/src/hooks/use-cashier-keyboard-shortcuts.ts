import { useEffect } from "react";

export type CashierShortcutHandlers = {
  onFocusOrderSearch?: () => void;
  onFocusMenuSearch?: () => void;
  onNewOrder?: () => void;
  onAcceptPayment?: () => void;
  onPrint?: () => void;
  onClearSelection?: () => void;
  onSelectPaymentMethod?: (index: number) => void;
  onToggleHistory?: () => void;
  onHold?: () => void;
  onDiscount?: () => void;
  onCustomer?: () => void;
  onKitchen?: () => void;
  onShowShortcuts?: () => void;
  onBarcodeScan?: () => void;
};

export function useCashierKeyboardShortcuts(handlers: CashierShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || target?.isContentEditable;

      if (e.key === "Escape") {
        handlers.onClearSelection?.();
        return;
      }
      if (isInput && !e.ctrlKey && !e.metaKey) return;

      if (e.key === "F1") {
        e.preventDefault();
        handlers.onFocusMenuSearch?.();
      } else if (e.key === "F2") {
        e.preventDefault();
        handlers.onNewOrder?.();
      } else if (e.key === "F3") {
        e.preventDefault();
        handlers.onAcceptPayment?.();
      } else if (e.key === "F4") {
        e.preventDefault();
        handlers.onPrint?.();
      } else if (e.key === "F5") {
        e.preventDefault();
        handlers.onHold?.();
      } else if (e.key === "F6") {
        e.preventDefault();
        handlers.onDiscount?.();
      } else if (e.key === "F7") {
        e.preventDefault();
        handlers.onCustomer?.();
      } else if (e.key === "F8") {
        e.preventDefault();
        handlers.onKitchen?.();
      } else if (e.key === "F9") {
        e.preventDefault();
        handlers.onToggleHistory?.();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlers.onPrint?.();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        handlers.onShowShortcuts?.();
      } else if (e.key === "/" && !isInput) {
        e.preventDefault();
        handlers.onFocusMenuSearch?.();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handlers.onBarcodeScan?.();
      } else if (e.key >= "1" && e.key <= "5" && !isInput) {
        handlers.onSelectPaymentMethod?.(Number(e.key) - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, handlers]);
}
