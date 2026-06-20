import type { StaffOrderRow } from "@/services/orders";
import {
  calculateBillTotals,
  printFinalInvoice,
  printKitchenKot,
  staffOrderItemsToCartLines,
  type PaymentMethodId,
  PAYMENT_METHOD_LABELS
} from "@/services/restaurant-orders";
import type { PrinterRow } from "@/hooks/use-printers";
import type { PosSettingsDoc } from "@shared/types/pos-settings";

type PrintParams = {
  order: StaffOrderRow;
  paymentMethod: PaymentMethodId;
  taxPercent: number;
  printers: PrinterRow[];
  posSettings: PosSettingsDoc;
};

function resolvePrinterLabel(printers: PrinterRow[], id: string | undefined, role: "counter" | "kitchen") {
  const byId = id ? printers.find((p) => p.id === id) : undefined;
  const byRole = printers.find((p) => p.role === role);
  const p = byId ?? byRole;
  if (!p) return role === "counter" ? "Counter printer" : "Kitchen printer";
  return p.ipAddress ? `${p.name} (${p.ipAddress})` : p.name;
}

/** Print customer receipt + kitchen KOT after payment. Uses web print + optional Electron thermal. */
export async function printCashierOrderDocuments({
  order,
  paymentMethod,
  taxPercent,
  printers,
  posSettings
}: PrintParams): Promise<void> {
  const lines = staffOrderItemsToCartLines(order.items);
  const { subtotal, taxAmount, grandTotal, taxPercent: tax } = calculateBillTotals(order.totalAmount, taxPercent);
  const token = typeof order.tokenNumber === "number" && order.tokenNumber > 0 ? `#${order.tokenNumber}` : "—";
  const table = order.tableName ?? "Parcel";
  const counterLabel = resolvePrinterLabel(printers, posSettings.counterPrinterId, "counter");

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

  await printKitchenKot(order);

  if (window.posApi?.emitNewOrder) {
    try {
      const kitchenOrder = {
        orderId: 0,
        orderNumber: order.id.slice(0, 12),
        tableNumber: order.tableName,
        source: "takeaway" as const,
        total: order.totalAmount,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
        items: order.items.map((it, i) => ({
          productId: i,
          name: it.name,
          quantity: it.qty,
          price: it.price
        }))
      };
      await window.posApi.emitNewOrder(kitchenOrder);
    } catch {
      // KDS broadcast is best-effort
    }
  }
}
