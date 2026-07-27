import AsyncStorage from "@react-native-async-storage/async-storage";

/** Local POS preference for post-payment receipt printing. */
export type ReceiptPrintPreference = "ask" | "always" | "never";

const STORAGE_KEY = "@cashier_pos/receipt_print_preference";

export async function getReceiptPrintPreference(): Promise<ReceiptPrintPreference> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === "ask" || raw === "always" || raw === "never") return raw;
  } catch {
    /* ignore */
  }
  return "ask";
}

export async function setReceiptPrintPreference(value: ReceiptPrintPreference): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, value);
}

export function receiptPrintPreferenceLabel(value: ReceiptPrintPreference): string {
  if (value === "always") return "Always print";
  if (value === "never") return "Skip printing";
  return "Ask each time";
}
