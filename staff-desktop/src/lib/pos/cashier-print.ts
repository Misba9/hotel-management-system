import type { StaffOrderRow } from "@/services/orders";
import {
  calculateBillTotals,
  printFinalInvoice,
  staffOrderItemsToCartLines,
  type PaymentMethodId,
  PAYMENT_METHOD_LABELS
} from "@/services/restaurant-orders";
import { printKitchenKot } from "@/services/kitchen-kot-print";
import type { PrinterRow } from "@/hooks/use-printers";
import type { PosSettingsDoc } from "@shared/types/pos-settings";

type PrintParams = {
  order: StaffOrderRow;
  paymentMethod: PaymentMethodId;
  taxPercent: number;
  printers: PrinterRow[];
  posSettings: PosSettingsDoc;
};

export type CashierPrintResult = {
  receiptPrinted: boolean;
  kotPrinted: boolean;
  warnings: string[];
};

function resolvePrinterLabel(printers: PrinterRow[], id: string | undefined, role: "counter" | "kitchen") {
  const byId = id ? printers.find((p) => p.id === id) : undefined;
  const byRole = printers.find((p) => p.role === role);
  const p = byId ?? byRole;
  if (!p) return role === "counter" ? "Counter printer" : "Kitchen printer";
  return p.ipAddress ? `${p.name} (${p.ipAddress})` : p.name;
}

/**
 * Print customer receipt + kitchen KOT after payment.
 * Never throws — order confirmation must not depend on printer availability.
 */
export async function printCashierOrderDocuments({
  order,
  paymentMethod,
  taxPercent,
  printers,
  posSettings
}: PrintParams): Promise<CashierPrintResult> {
  const lines = staffOrderItemsToCartLines(order.items);
  const { subtotal, taxAmount, grandTotal, taxPercent: tax } = calculateBillTotals(order.totalAmount, taxPercent);
  const token = typeof order.tokenNumber === "number" && order.tokenNumber > 0 ? `#${order.tokenNumber}` : "—";
  const table = order.tableName ?? "Parcel";

  const counterLabel = resolvePrinterLabel(printers, posSettings.counterPrinterId, "counter");
  const kitchenLabel = resolvePrinterLabel(printers, posSettings.kitchenPrinterId, "kitchen");

  const warnings: string[] = [];
  let receiptPrinted = false;
  let kotPrinted = false;

  try {
    await printFinalInvoice({
      orderIdShort: order.id.slice(0, 10).toUpperCase(),
      tableLabel: `${table} · ${counterLabel}`,
      tokenLabel: token,
      items: lines,
      subtotal,
      taxPercent: tax,
      taxAmount,
      grandTotal,
      paymentMethodLabel: PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod
    });
    receiptPrinted = true;
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : "Receipt could not be printed");
  }

  try {
    await printKitchenKot(order, { source: "manual" });
    kotPrinted = true;
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : "Kitchen ticket could not be printed");
  }

  if (import.meta.env.DEV && kotPrinted) {
    console.log(`[print] Kitchen copy → ${kitchenLabel}`);
  }

  return { receiptPrinted, kotPrinted, warnings };
}
