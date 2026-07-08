import AsyncStorage from "@react-native-async-storage/async-storage";

export const KITCHEN_AUTO_PRINT_KEY = "staff:kitchen:auto_print";

/** Default off — staff enables auto KOT print manually in Kitchen → Settings. */
export async function readKitchenAutoPrintEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KITCHEN_AUTO_PRINT_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

export async function writeKitchenAutoPrintEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KITCHEN_AUTO_PRINT_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}
