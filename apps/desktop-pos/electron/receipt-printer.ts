import { SerialPort } from "serialport";
import {
  BreakLine,
  CharacterSet,
  PrinterTypes,
  ThermalPrinter
} from "node-thermal-printer";

export type ReceiptLineItem = {
  name: string;
  quantity: number;
  price: number;
  notes?: string;
};

export type ReceiptOrderData = {
  orderId: number;
  orderNumber: string;
  tableNumber?: string;
  source: string;
  paymentMethod: string;
  createdAt: string;
  specialNotes?: string;
  items: ReceiptLineItem[];
  subtotal: number;
  tax: number;
  total: number;
};

const PRINTER_VENDOR_IDS = new Set(["04b8", "0519", "154f", "0fe6", "1fc9", "1659"]);
const PRINTER_KEYWORDS = ["epson", "star", "bixolon", "xprinter", "rongta", "gprinter"];

function env(name: string): string | undefined {
  const raw = process.env[name];
  return raw?.trim() || undefined;
}

function restaurantName(): string {
  return env("DESKTOP_POS_RESTAURANT_NAME") ?? "Nausheen Fruits";
}

function feedbackUrl(orderNumber: string): string {
  const base =
    env("DESKTOP_POS_FEEDBACK_URL") ??
    "https://nausheen-fruits.web.app/feedback";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}order=${encodeURIComponent(orderNumber)}`;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(iso));
}

export function computeTaxBreakdown(subtotal: number): { subtotal: number; tax: number; total: number } {
  const rate = Number(env("DESKTOP_POS_TAX_RATE") ?? "0.05");
  const safeRate = Number.isFinite(rate) && rate >= 0 ? rate : 0;
  const tax = Math.round(subtotal * safeRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal, tax, total };
}

/** Scan USB serial devices for common thermal printer vendors. */
export async function detectUsbPrinterInterface(): Promise<string | null> {
  try {
    const ports = await SerialPort.list();
    const match = ports.find((port) => {
      const vendor = (port.vendorId ?? "").toLowerCase();
      if (vendor && PRINTER_VENDOR_IDS.has(vendor)) return true;

      const haystack = `${port.manufacturer ?? ""} ${port.pnpId ?? ""} ${port.path ?? ""}`.toLowerCase();
      return PRINTER_KEYWORDS.some((keyword) => haystack.includes(keyword));
    });

    return match?.path ?? null;
  } catch (error) {
    console.warn("[print] USB scan failed:", error);
    return null;
  }
}

async function resolvePrinterInterface(): Promise<string | null> {
  const configured = env("POS_PRINTER_INTERFACE");
  if (configured) return configured;
  return detectUsbPrinterInterface();
}

function printerTypeFromEnv(): PrinterTypes {
  const raw = (env("POS_PRINTER_TYPE") ?? "epson").toLowerCase();
  if (raw.includes("star")) return PrinterTypes.STAR;
  if (raw.includes("brother")) return PrinterTypes.BROTHER;
  return PrinterTypes.EPSON;
}

export async function printReceipt(
  orderData: ReceiptOrderData
): Promise<{ ok: boolean; error?: string }> {
  const printerInterface = await resolvePrinterInterface();
  if (!printerInterface) {
    console.warn("[print] No USB/serial printer detected — set POS_PRINTER_INTERFACE to override.");
    return { ok: false, error: "no_printer_detected" };
  }

  const printer = new ThermalPrinter({
    type: printerTypeFromEnv(),
    interface: printerInterface,
    characterSet: CharacterSet.PC852_LATIN2,
    removeSpecialCharacters: false,
    lineCharacter: "-",
    breakLine: BreakLine.WORD,
    options: { timeout: 8000 }
  });

  const connected = await printer.isPrinterConnected();
  if (!connected) {
    console.warn(`[print] Printer not reachable at ${printerInterface}`);
    return { ok: false, error: "printer_unreachable" };
  }

  printer.alignCenter();
  printer.bold(true);
  printer.setTextSize(1, 1);
  printer.println(restaurantName());
  printer.bold(false);
  printer.setTextNormal();
  printer.println("Fresh fruits · Juices · Bowls");
  printer.drawLine();

  printer.alignLeft();
  printer.println(`Order: ${orderData.orderNumber}`);
  printer.println(`Date:  ${formatTimestamp(orderData.createdAt)}`);
  printer.println(`Source: ${orderData.source}`);
  if (orderData.tableNumber) {
    printer.println(`Table: ${orderData.tableNumber}`);
  }
  printer.println(`Payment: ${orderData.paymentMethod}`);
  printer.drawLine();

  for (const item of orderData.items) {
    const lineTotal = item.price * item.quantity;
    printer.alignLeft();
    printer.tableCustom([
      { text: `${item.quantity}x ${item.name}`, align: "LEFT", width: 0.72 },
      { text: formatMoney(lineTotal), align: "RIGHT", width: 0.28 }
    ]);
    if (item.notes?.trim()) {
      printer.println(`   * ${item.notes.trim()}`);
    }
  }

  if (orderData.specialNotes?.trim()) {
    printer.drawLine();
    printer.println(`Notes: ${orderData.specialNotes.trim()}`);
  }

  printer.drawLine();
  printer.tableCustom([
    { text: "Subtotal", align: "LEFT", width: 0.72 },
    { text: formatMoney(orderData.subtotal), align: "RIGHT", width: 0.28 }
  ]);
  printer.tableCustom([
    { text: "Tax", align: "LEFT", width: 0.72 },
    { text: formatMoney(orderData.tax), align: "RIGHT", width: 0.28 }
  ]);
  printer.bold(true);
  printer.tableCustom([
    { text: "Total", align: "LEFT", width: 0.72 },
    { text: formatMoney(orderData.total), align: "RIGHT", width: 0.28 }
  ]);
  printer.bold(false);

  printer.newLine();
  printer.alignCenter();
  printer.println("Scan for feedback");
  printer.printQR(feedbackUrl(orderData.orderNumber), {
    cellSize: 6,
    correction: "M",
    model: 2
  });
  printer.newLine();
  printer.println("Thank you!");
  printer.cut();

  try {
    await printer.execute();
    console.info(`[print] Receipt printed for ${orderData.orderNumber} via ${printerInterface}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[print] Failed to print receipt:", message);
    return { ok: false, error: message };
  }
}

export type KitchenTicketData = {
  orderNumber: string;
  source: string;
  createdAt: string;
  specialNotes?: string;
  items: Array<{
    name: string;
    quantity: number;
    notes?: string;
  }>;
};

export async function printKitchenTicket(
  ticket: KitchenTicketData
): Promise<{ ok: boolean; error?: string }> {
  const printerInterface = await resolvePrinterInterface();
  if (!printerInterface) {
    return { ok: false, error: "no_printer_detected" };
  }

  const printer = new ThermalPrinter({
    type: printerTypeFromEnv(),
    interface: printerInterface,
    characterSet: CharacterSet.PC852_LATIN2,
    removeSpecialCharacters: false,
    lineCharacter: "-",
    breakLine: BreakLine.WORD,
    options: { timeout: 8000 }
  });

  const connected = await printer.isPrinterConnected();
  if (!connected) {
    return { ok: false, error: "printer_unreachable" };
  }

  printer.alignCenter();
  printer.bold(true);
  printer.println("KITCHEN TICKET");
  printer.bold(false);
  printer.drawLine();

  printer.alignLeft();
  printer.println(`Order: ${ticket.orderNumber}`);
  printer.println(`Channel: ${ticket.source.toUpperCase()}`);
  printer.println(`Time: ${formatTimestamp(ticket.createdAt)}`);
  printer.drawLine();

  for (const item of ticket.items) {
    printer.bold(true);
    printer.println(`${item.quantity}x ${item.name}`);
    printer.bold(false);
    if (item.notes?.trim()) {
      printer.println(`  * ${item.notes.trim()}`);
    }
  }

  if (ticket.specialNotes?.trim()) {
    printer.drawLine();
    printer.println(`NOTES: ${ticket.specialNotes.trim()}`);
  }

  printer.newLine();
  printer.alignCenter();
  printer.println("--- PREP NOW ---");
  printer.cut();

  try {
    await printer.execute();
    console.info(`[print] Kitchen ticket printed for ${ticket.orderNumber}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[print] Failed to print kitchen ticket:", message);
    return { ok: false, error: message };
  }
}
