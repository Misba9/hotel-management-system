"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp
} from "firebase/firestore";
import { Bike, Loader2, MapPin, RefreshCw } from "lucide-react";
import { PageShell } from "@/components/admin/page-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFirebaseDb } from "@/lib/firebase";
import { adminApiFetch } from "@/shared/lib/admin-api";

type DeliveryOrder = {
  id: string;
  orderNumber?: string;
  customerName?: string;
  phone?: string;
  source?: string;
  orderType?: string;
  total?: number;
  status?: string;
  deliveryAddress?: {
    addressLine?: string;
    city?: string;
    pincode?: string;
    lat?: number;
    lng?: number;
  };
  rapidoRideId?: string;
  rapidoStatus?: string;
  createdAt?: string | null;
};

type RapidoTracking = {
  status?: string;
  driverName?: string;
  driverPhone?: string;
  etaMinutes?: number;
};

const RESTAURANT_LAT = Number(process.env.NEXT_PUBLIC_RESTAURANT_LAT ?? "17.385");
const RESTAURANT_LNG = Number(process.env.NEXT_PUBLIC_RESTAURANT_LNG ?? "78.4867");
const RESTAURANT_ADDRESS =
  process.env.NEXT_PUBLIC_RESTAURANT_ADDRESS ?? "Restaurant pickup counter";

function serializeCreatedAt(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as Timestamp).toDate().toISOString();
  }
  return null;
}

function isOnlineOrder(order: DeliveryOrder): boolean {
  const source = (order.source ?? "").toLowerCase();
  const orderType = (order.orderType ?? "").toLowerCase();
  return (
    orderType === "online" ||
    source === "zomato" ||
    source === "swiggy" ||
    source === "website" ||
    source === "online"
  );
}

export default function DeliveryManagement() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [trackingByOrder, setTrackingByOrder] = useState<Record<string, RapidoTracking>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getFirebaseDb();
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(60));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : doc.id,
            customerName: typeof data.customerName === "string" ? data.customerName : undefined,
            phone: typeof data.phone === "string" ? data.phone : undefined,
            source: typeof data.source === "string" ? data.source : undefined,
            orderType: typeof data.orderType === "string" ? data.orderType : undefined,
            total: typeof data.total === "number" ? data.total : undefined,
            status: typeof data.status === "string" ? data.status : undefined,
            deliveryAddress:
              typeof data.deliveryAddress === "object" && data.deliveryAddress
                ? (data.deliveryAddress as DeliveryOrder["deliveryAddress"])
                : undefined,
            rapidoRideId: typeof data.rapidoRideId === "string" ? data.rapidoRideId : undefined,
            rapidoStatus: typeof data.rapidoStatus === "string" ? data.rapidoStatus : undefined,
            createdAt: serializeCreatedAt(data.createdAt)
          } satisfies DeliveryOrder;
        });
        setOrders(rows.filter(isOnlineOrder));
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const onlineOrders = useMemo(() => orders, [orders]);

  const refreshTracking = useCallback(async (order: DeliveryOrder) => {
    if (!order.rapidoRideId) return;
    const response = await adminApiFetch(
      `/api/rapido/track/${encodeURIComponent(order.rapidoRideId)}?orderId=${encodeURIComponent(order.id)}`
    );
    const json = (await response.json()) as { tracking?: RapidoTracking; error?: string };
    if (!response.ok) throw new Error(json.error ?? "Tracking failed");
    if (json.tracking) {
      setTrackingByOrder((prev) => ({ ...prev, [order.id]: json.tracking! }));
    }
  }, []);

  const bookRapido = async (order: DeliveryOrder) => {
    setBusyOrderId(order.id);
    setError(null);

    try {
      const dropLat = order.deliveryAddress?.lat ?? RESTAURANT_LAT + 0.01;
      const dropLng = order.deliveryAddress?.lng ?? RESTAURANT_LNG + 0.01;
      const dropAddress =
        order.deliveryAddress?.addressLine ??
        [order.deliveryAddress?.city, order.deliveryAddress?.pincode].filter(Boolean).join(", ") ??
        "Customer delivery address";

      const estimateResponse = await adminApiFetch("/api/rapido/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          pickupLat: RESTAURANT_LAT,
          pickupLng: RESTAURANT_LNG,
          dropLat,
          dropLng
        })
      });
      const estimateJson = (await estimateResponse.json()) as { error?: string };
      if (!estimateResponse.ok) throw new Error(estimateJson.error ?? "Estimate failed");

      const bookResponse = await adminApiFetch("/api/rapido/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          pickupLat: RESTAURANT_LAT,
          pickupLng: RESTAURANT_LNG,
          dropLat,
          dropLng,
          pickupAddress: RESTAURANT_ADDRESS,
          dropAddress,
          customerName: order.customerName ?? "Customer",
          customerPhone: order.phone ?? "9999999999"
        })
      });
      const bookJson = (await bookResponse.json()) as {
        booking?: { rideId?: string; status?: string };
        error?: string;
      };
      if (!bookResponse.ok) throw new Error(bookJson.error ?? "Booking failed");

      if (bookJson.booking?.rideId) {
        await refreshTracking({ ...order, rapidoRideId: bookJson.booking.rideId });
      }
    } catch (bookError) {
      setError(bookError instanceof Error ? bookError.message : "Rapido booking failed");
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <PageShell
      badge="Delivery"
      title="Delivery Management"
      description="Book Rapido rides for online orders and track delivery status in real time."
    >
      {error ? (
        <GlassCard className="border border-rose-500/30 text-rose-200">{error}</GlassCard>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-theme-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading online orders…
        </div>
      ) : onlineOrders.length === 0 ? (
        <GlassCard>No online delivery orders yet.</GlassCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {onlineOrders.map((order) => {
            const tracking = trackingByOrder[order.id];
            const busy = busyOrderId === order.id;

            return (
              <GlassCard key={order.id} hover className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-theme-text-primary">
                      {order.orderNumber ?? order.id}
                    </h3>
                    <p className="text-sm text-theme-text-secondary">
                      {order.customerName ?? "Customer"} · {order.phone ?? "—"}
                    </p>
                  </div>
                  <Badge variant="neutral">{(order.source ?? order.orderType ?? "online").toUpperCase()}</Badge>
                </div>

                <div className="space-y-2 text-sm text-theme-text-secondary">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-brand-primary" />
                    <span>
                      {order.deliveryAddress?.addressLine ??
                        [order.deliveryAddress?.city, order.deliveryAddress?.pincode]
                          .filter(Boolean)
                          .join(", ") ??
                        "Address not provided"}
                    </span>
                  </div>
                  <div>Order status: {order.status ?? "preparing"}</div>
                  <div>Total: ₹{order.total ?? 0}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={busy || Boolean(order.rapidoRideId)}
                    onClick={() => void bookRapido(order)}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bike className="h-4 w-4" />}
                    Book Rapido
                  </Button>

                  {order.rapidoRideId ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void refreshTracking(order)}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh Tracking
                    </Button>
                  ) : null}
                </div>

                {order.rapidoRideId || tracking ? (
                  <div className="rounded-xl border border-theme-border bg-theme-hover p-3 text-sm text-theme-text-primary/75">
                    <div className="font-semibold text-theme-text-primary">Rapido Tracking</div>
                    <div>Ride ID: {order.rapidoRideId ?? "—"}</div>
                    <div>Status: {tracking?.status ?? order.rapidoStatus ?? "booked"}</div>
                    {tracking?.driverName ? <div>Driver: {tracking.driverName}</div> : null}
                    {tracking?.driverPhone ? <div>Phone: {tracking.driverPhone}</div> : null}
                    {tracking?.etaMinutes != null ? <div>ETA: {tracking.etaMinutes} min</div> : null}
                  </div>
                ) : null}
              </GlassCard>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
