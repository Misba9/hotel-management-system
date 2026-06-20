export type KitchenOrderStatus = "pending" | "preparing" | "ready";

export type KitchenOrderItem = {
  productId: number;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
};

export type KitchenOrder = {
  orderId: number;
  orderNumber: string;
  tableNumber?: string;
  source: "dine-in" | "takeaway" | "zomato" | "swiggy";
  total: number;
  status: KitchenOrderStatus;
  createdAt: string;
  specialNotes?: string;
  items: KitchenOrderItem[];
};

export type OrderStatusUpdate = {
  orderId: number;
  orderNumber: string;
  status: KitchenOrderStatus;
};

const HUB_PORT = 3001;
const STORAGE_KEY = "kds-cashier-ip";

export function getStoredCashierIp(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "localhost";
}

export function setStoredCashierIp(ip: string): void {
  localStorage.setItem(STORAGE_KEY, ip.trim());
}

export function buildHubUrl(ip: string): string {
  const host = ip.trim() || "localhost";
  return `http://${host}:${HUB_PORT}`;
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
