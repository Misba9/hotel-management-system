import { normalizeOrderStatus } from "@shared/utils/canonical-order-fields";
import type { StaffOrderRow } from "@/services/orders";

export type KitchenOrderStatus = "new" | "accepted" | "preparing" | "ready";

/** Kitchen queue status from Firestore `status` — payment does not remove orders from KDS. */
export function resolveKitchenQueueStatus(order: StaffOrderRow): KitchenOrderStatus | null {
  const canon = normalizeOrderStatus(String(order.status ?? ""));
  if (canon === "cancelled" || canon === "completed") return null;
  if (canon === "ready") return "ready";
  if (canon === "preparing") return "preparing";
  if (canon === "accepted") return "accepted";
  if (canon === "new") return "new";
  return null;
}

export type KitchenOrderItem = {
  productId: number | string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
};

export type KitchenOrder = {
  orderId: string;
  orderNumber: string;
  tableNumber?: string;
  source: "dine-in" | "takeaway" | "zomato" | "swiggy";
  total: number;
  status: KitchenOrderStatus;
  createdAt: string;
  specialNotes?: string;
  customerName?: string;
  orderType?: string;
  waiterName?: string;
  acceptedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  items: KitchenOrderItem[];
};

export function minutesSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

export function formatElapsed(iso: string): string {
  const m = minutesSince(iso);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export function playNewOrderSound(): void {
  try {
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);

    window.setTimeout(() => {
      void ctx.close();
    }, 600);
  } catch {
    /* ignore audio failures */
  }
}

export function formatSource(source: KitchenOrder["source"]): string {
  const labels: Record<KitchenOrder["source"], string> = {
    "dine-in": "Dine-in",
    takeaway: "Takeaway",
    zomato: "Zomato",
    swiggy: "Swiggy"
  };
  return labels[source];
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}
