import { useCallback, useEffect, useMemo, useState } from "react";
import { DesktopAppShell } from "@/components/DesktopAppShell";
import { KitchenHistoryPanel } from "@/components/kitchen/KitchenHistoryPanel";
import { KitchenNav } from "@/components/kitchen/KitchenNav";
import {
  NewOrderCard,
  PreparingOrderCard,
  ReadyOrderCard
} from "@/components/kitchen/KitchenOrderCards";
import { useAuth } from "@/contexts/AuthContext";
import { useCloudConnection } from "@/contexts/CloudConnectionContext";
import { useKitchenNavCounts } from "@/hooks/useKitchenNavCounts";
import { useKitchenStageOrders } from "@/hooks/useKitchenStageOrders";
import type { KitchenStage } from "@/lib/kitchen-order-mapper";
import type { KitchenOrder } from "@/lib/kds-utils";
import {
  kitchenAcceptOrder,
  kitchenMarkOrderReady,
  kitchenMarkPickedUp,
  kitchenMarkPreparing
} from "@/services/orders";

export function KitchenDashboard() {
  const { logout } = useAuth();
  const { connectionState, online, realtimeReady } = useCloudConnection();
  const [stage, setStage] = useState<KitchenStage>("active");
  const counts = useKitchenNavCounts(true);
  const { orders, historyOrders, rowsById, loading, error } = useKitchenStageOrders(stage, true);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const newOrders = useMemo(
    () => orders.filter((order) => order.status === "new"),
    [orders]
  );
  const preparingOrders = useMemo(
    () => orders.filter((order) => order.status === "accepted" || order.status === "preparing"),
    [orders]
  );

  useEffect(() => {
    if (stage !== "active" || newOrders.length === 0) return;
    const latest = newOrders[newOrders.length - 1];
    setNewOrderIds((prev) => {
      if (prev.has(latest.orderId)) return prev;
      const next = new Set(prev);
      next.add(latest.orderId);
      window.setTimeout(() => {
        setNewOrderIds((current) => {
          const cleaned = new Set(current);
          cleaned.delete(latest.orderId);
          return cleaned;
        });
      }, 2500);
      return next;
    });
  }, [newOrders, stage]);

  const runAction = useCallback(
    async (order: KitchenOrder, action: "accept" | "preparing" | "ready" | "picked-up") => {
      const row = rowsById.get(order.orderId);
      if (!row) {
        setStatusMessage("Order not found — wait for sync.");
        return;
      }
      try {
        if (action === "accept") await kitchenAcceptOrder(row);
        else if (action === "preparing") await kitchenMarkPreparing(row);
        else if (action === "ready") await kitchenMarkOrderReady(row);
        else await kitchenMarkPickedUp(row);

        const labels: Record<typeof action, string> = {
          accept: "accepted",
          preparing: "marked preparing",
          ready: "marked ready",
          "picked-up": "marked picked up"
        };
        setStatusMessage(`Order ${order.orderNumber} ${labels[action]}`);
      } catch (err) {
        setStatusMessage(err instanceof Error ? err.message : "Failed to update order");
      }
    },
    [rowsById]
  );

  const connectionLabel =
    connectionState === "connected" && realtimeReady
      ? "Live · Cloud connected"
      : connectionState === "connecting" || connectionState === "reconnecting"
        ? "Connecting to cloud…"
        : online
          ? "Realtime reconnecting…"
          : "Offline · cached mode";

  const emptyMessage =
    stage === "active"
      ? { title: "No active orders", hint: "New and in-progress tickets appear here" }
      : stage === "ready"
        ? { title: "No orders ready", hint: "Finished tickets wait here for pickup" }
        : { title: "No history", hint: "Completed and cancelled orders archive here" };

  return (
    <DesktopAppShell title="Kitchen" subtitle={connectionLabel} onLogout={() => void logout()}>
      <div className="kds-shell h-full">
        <KitchenNav stage={stage} counts={counts} onStageChange={setStage} />
        <main className="kds-main">
          {error ? (
            <p className="mb-4 rounded-lg bg-red-900/40 px-4 py-3 text-sm text-red-200">{error}</p>
          ) : null}
          {statusMessage ? (
            <p className="mb-4 rounded-lg bg-teal-900/40 px-4 py-3 text-sm text-teal-100">{statusMessage}</p>
          ) : null}

          {loading ? (
            <div className="kds-empty">
              <strong>Loading orders…</strong>
              <span>Connecting to kitchen queue</span>
            </div>
          ) : stage === "history" ? (
            <KitchenHistoryPanel orders={historyOrders} />
          ) : stage === "active" ? (
            newOrders.length === 0 && preparingOrders.length === 0 ? (
              <div className="kds-empty">
                <strong>{emptyMessage.title}</strong>
                <span>{emptyMessage.hint}</span>
              </div>
            ) : (
              <div className="kds-active-sections">
                {newOrders.length > 0 ? (
                  <section aria-label="New orders">
                    <h2 className="kds-section-title">New</h2>
                    <div className="kds-grid">
                      {newOrders.map((order) => (
                        <NewOrderCard
                          key={order.orderId}
                          order={order}
                          isNew={newOrderIds.has(order.orderId)}
                          onAccept={() => void runAction(order, "accept")}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {preparingOrders.length > 0 ? (
                  <section aria-label="Preparing orders">
                    <h2 className="kds-section-title">Preparing</h2>
                    <div className="kds-grid">
                      {preparingOrders.map((order) => (
                        <PreparingOrderCard
                          key={order.orderId}
                          order={order}
                          onPreparing={() => void runAction(order, "preparing")}
                          onReady={() => void runAction(order, "ready")}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )
          ) : orders.length === 0 ? (
            <div className="kds-empty">
              <strong>{emptyMessage.title}</strong>
              <span>{emptyMessage.hint}</span>
            </div>
          ) : (
            <section className="kds-grid kds-ready-grid" aria-label="Ready for pickup">
              {orders.map((order) => (
                <ReadyOrderCard
                  key={order.orderId}
                  order={order}
                  onNotifyWaiter={() =>
                    setStatusMessage(
                      order.waiterName
                        ? `Notified ${order.waiterName} for ${order.orderNumber}`
                        : `Pickup alert sent for ${order.orderNumber}`
                    )
                  }
                  onPickedUp={() => void runAction(order, "picked-up")}
                />
              ))}
            </section>
          )}
        </main>
      </div>
    </DesktopAppShell>
  );
}
