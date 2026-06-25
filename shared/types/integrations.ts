export type IntegrationId =
  | "swiggy"
  | "zomato"
  | "ondc"
  | "razorpay"
  | "phonepe"
  | "stripe"
  | "whatsapp"
  | "google_maps";

export type IntegrationCategory = "Delivery" | "Payments" | "Messaging" | "Location";

export type IntegrationConnectionStatus = "connected" | "pending" | "disconnected";

export type IntegrationSyncLogStatus = "success" | "error" | "warning";

/** `integrations/{id}` — admin-managed enablement and sync metadata. */
export type IntegrationDoc = {
  enabled: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: IntegrationSyncLogStatus;
  updatedAt?: string;
};

/** `integration_sync_logs/{id}` */
export type IntegrationSyncLogDoc = {
  integrationId: IntegrationId;
  service: string;
  event: string;
  status: IntegrationSyncLogStatus;
  createdAt: string;
};

export type IntegrationCatalogItem = {
  id: IntegrationId;
  name: string;
  category: IntegrationCategory;
  /** When connected, show "Live" instead of relative last-sync time. */
  liveWhenConnected?: boolean;
  description: string;
};

export const INTEGRATION_CATALOG: IntegrationCatalogItem[] = [
  {
    id: "swiggy",
    name: "Swiggy",
    category: "Delivery",
    description: "Inbound orders via Swiggy partner webhook."
  },
  {
    id: "zomato",
    name: "Zomato",
    category: "Delivery",
    description: "Inbound orders via Zomato partner webhook."
  },
  {
    id: "ondc",
    name: "ONDC",
    category: "Delivery",
    description: "Open Network for Digital Commerce — catalog and order sync."
  },
  {
    id: "razorpay",
    name: "Razorpay",
    category: "Payments",
    liveWhenConnected: true,
    description: "Online payments and POS card/UPI via Razorpay."
  },
  {
    id: "phonepe",
    name: "PhonePe",
    category: "Payments",
    liveWhenConnected: true,
    description: "PhonePe payment gateway for checkout and POS."
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "Payments",
    description: "International card payments via Stripe."
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    category: "Messaging",
    description: "OTP and order updates via WhatsApp (Twilio)."
  },
  {
    id: "google_maps",
    name: "Google Maps",
    category: "Location",
    liveWhenConnected: true,
    description: "Live delivery tracking and address autocomplete."
  }
];

export type IntegrationApiRow = {
  id: IntegrationId;
  name: string;
  category: IntegrationCategory;
  description: string;
  status: IntegrationConnectionStatus;
  enabled: boolean;
  credentialsReady: boolean;
  missingEnv: string[];
  lastSyncAt: string | null;
  lastSyncLabel: string;
  webhookUrl: string | null;
  liveWhenConnected: boolean;
};
