import { SerialPort } from "serialport";
import {
  BreakLine,
  CharacterSet,
  PrinterTypes,
  ThermalPrinter
} from "node-thermal-printer";
import { loadSettings } from "./settings-store";
import type { PrintInvoicePayload, PrintKotPayload, PrinterDevice } from "./main-types";

const PRINTER_VENDOR_IDS = new Set(["04b8", "0519", "154f", "0fe6", "1fc9", "1659"]);
const PRINTER_KEYWORDS = ["epson", "star", "bixolon", "xprinter", "rongta", "gprinter"];

function env(name: string): string | undefined {
  const raw = process.env[name];
  return raw?.trim() || undefined;
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

function printerTypeFromEnv(): PrinterTypes {
  const raw = (env("STAFF_DESKTOP_PRINTER_TYPE") ?? env("POS_PRINTER_TYPE") ?? "epson").toLowerCase();
  if (raw.includes("star")) return PrinterTypes.STAR;
  if (raw.includes("brother")) return PrinterTypes.BROTHER;
  return PrinterTypes.EPSON;
}

export async function listPrinterDevices(): Promise<PrinterDevice[]> {
  try {
    const ports = await SerialPort.list();
    return ports
      .filter((port) => {
        const vendor = (port.vendorId ?? "").toLowerCase();
        if (vendor && PRINTER_VENDOR_IDS.has(vendor)) return true;
        const haystack = `${port.manufacturer ?? ""} ${port.pnpId ?? ""} ${port.path ?? ""}`.toLowerCase();
        return PRINTER_KEYWORDS.some((keyword) => haystack.includes(keyword)) || Boolean(port.path);
      })
      .map((port) => ({
        path: port.path,
        manufacturer: port.manufacturer,
        vendorId: port.vendorId,
        productId: port.productId
      }));
  } catch (error) {
    console.warn("[print] Failed to list serial devices:", error);
    return [];
  }
}

async function resolveInterface(role: "counter" | "kitchen"): Promise<string | null> {
  const settings = loadSettings();
  const configured =
    role === "kitchen" ? settings.kitchenPrinterInterface : settings.counterPrinterInterface;
  if (configured?.trim()) return configured.trim();

  const envKey = role === "kitchen" ? "STAFF_KITCHEN_PRINTER_INTERFACE" : "STAFF_COUNTER_PRINTER_INTERFACE";
  const fromEnv = env(envKey) ?? env("POS_PRINTER_INTERFACE");
  if (fromEnv) return fromEnv;

  const devices = await listPrinterDevices();
  return devices[0]?.path ?? null;
}

async function printWithInterface(
  printerInterface: string,
  build: (printer: ThermalPrinter) => void
): Promise<{ ok: boolean; error?: string }> {
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

  build(printer);

  try {
    await printer.execute();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

export async function printInvoice(payload: PrintInvoicePayload): Promise<{ ok: boolean; error?: string }> {
  const printerInterface = await resolveInterface("counter");
  if (!printerInterface) return { ok: false, error: "no_printer_detected" };

  const restaurantName = loadSettings().restaurantName || "Nausheen Fruits";

  return printWithInterface(printerInterface, (printer) => {
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(restaurantName);
    printer.bold(false);
    printer.setTextNormal();
    printer.println("INVOICE");
    printer.drawLine();

    printer.alignLeft();
    printer.println(`Order: ${payload.orderNumber}`);
    printer.println(`Date:  ${formatTimestamp(payload.createdAt)}`);
    printer.println(`Source: ${payload.source}`);
    if (payload.tableNumber) printer.println(`Table: ${payload.tableNumber}`);
    printer.println(`Payment: ${payload.paymentMethod}`);
    printer.drawLine();

    for (const item of payload.items) {
      const lineTotal = item.price * item.quantity;
      printer.tableCustom([
        { text: `${item.quantity}x ${item.name}`, align: "LEFT", width: 0.72 },
        { text: formatMoney(lineTotal), align: "RIGHT", width: 0.28 }
      ]);
      if (item.notes?.trim()) printer.println(`   * ${item.notes.trim()}`);
    }

    if (payload.specialNotes?.trim()) {
      printer.drawLine();
      printer.println(`Notes: ${payload.specialNotes.trim()}`);
    }

    printer.drawLine();
    printer.tableCustom([
      { text: "Subtotal", align: "LEFT", width: 0.72 },
      { text: formatMoney(payload.subtotal), align: "RIGHT", width: 0.28 }
    ]);
    printer.tableCustom([
      { text: "Tax", align: "LEFT", width: 0.72 },
      { text: formatMoney(payload.tax), align: "RIGHT", width: 0.28 }
    ]);
    printer.bold(true);
    printer.tableCustom([
      { text: "Total", align: "LEFT", width: 0.72 },
      { text: formatMoney(payload.total), align: "RIGHT", width: 0.28 }
    ]);
    printer.bold(false);
    printer.newLine();
    printer.alignCenter();
    printer.println("Thank you!");
    printer.cut();
  });
}

export async function printKot(payload: PrintKotPayload): Promise<{ ok: boolean; error?: string }> {
  const printerInterface = await resolveInterface("kitchen");
  if (!printerInterface) return { ok: false, error: "no_printer_detected" };

  return printWithInterface(printerInterface, (printer) => {
    printer.alignCenter();
    printer.bold(true);
    printer.println("KITCHEN ORDER TICKET");
    printer.bold(false);
    printer.drawLine();

    printer.alignLeft();
    printer.println(`Order: ${payload.orderNumber}`);
    printer.println(`Channel: ${payload.source.toUpperCase()}`);
    printer.println(`Time: ${formatTimestamp(payload.createdAt)}`);
    printer.drawLine();

    for (const item of payload.items) {
      printer.bold(true);
      printer.println(`${item.quantity}x ${item.name}`);
      printer.bold(false);
      if (item.notes?.trim()) printer.println(`  * ${item.notes.trim()}`);
    }

    if (payload.specialNotes?.trim()) {
      printer.drawLine();
      printer.println(`NOTES: ${payload.specialNotes.trim()}`);
    }

    printer.newLine();
    printer.alignCenter();
    printer.println("--- PREP NOW ---");
    printer.cut();
  });
}
