/** Online gateway or manual UPI at counter. */
export type PosPaymentProvider = "razorpay" | "manual";

export type PosPaymentMethodId = "cash" | "upi" | "card" | "wallet" | "split";

/** `settings/pos` — read by all staff; written by admin API. */
export type PosSettingsDoc = {
  /** GST / tax rate (mirrors settings/business.taxPercent). */
  taxPercent: number;
  paymentProvider: PosPaymentProvider;
  /** Merchant UPI VPA when provider is manual (e.g. store@upi). */
  upiVpa?: string;
  /** Bank display name for manual UPI QR label. */
  upiBankName?: string;
  /** Which methods appear on cashier POS. */
  enabledPaymentMethods: PosPaymentMethodId[];
  /** Printer doc ids from `printers` collection. */
  counterPrinterId?: string;
  kitchenPrinterId?: string;
  updatedAt?: string;
};

export const DEFAULT_POS_SETTINGS: PosSettingsDoc = {
  taxPercent: 5,
  paymentProvider: "manual",
  upiVpa: "",
  upiBankName: "",
  enabledPaymentMethods: ["cash", "upi", "card", "split"],
  counterPrinterId: "counter_bluetooth",
  kitchenPrinterId: "kitchen_receipt_default"
};

export const POS_SETTINGS_DOC_ID = "pos" as const;
