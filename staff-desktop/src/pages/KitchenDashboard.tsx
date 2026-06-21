import { useCallback, useEffect, useState } from "react";
import { DesktopAppShell } from "@/components/DesktopAppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useCloudConnection } from "@/contexts/CloudConnectionContext";
import { useKitchenOrders } from "@/hooks/useKitchenOrders";
import { formatSource, formatTime, type KitchenOrder } from "@/lib/kds-utils";
import { markChannelOrderPreparing, markChannelOrderReady } from "@/services/order-workflow";

export function KitchenDashboard() {
  const { logout } = useAuth();
  const { connectionState, online, realtimeReady } = useCloudConnection();
  const { activeOrders, readyOrders, loading, error } = useKitchenOrders(true);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeOrders.length === 0) return;
    const latest = activeOrders[0];
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
  }, [activeOrders]);

  const markPreparing = useCallback(async (order: KitchenOrder) => {
    try {
      await markChannelOrderPreparing(order.orderId);
      setStatusMessage(`Order ${order.orderNumber} marked preparing`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to update order");
    }
  }, []);

  const markReady = useCallback(async (order: KitchenOrder) => {
    try {
      await markChannelOrderReady(order.orderId);
      setStatusMessage(`Order ${order.orderNumber} marked ready`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Failed to update order");
    }
  }, []);

  const connectionLabel =
    connectionState === "connected" && realtimeReady
      ? "Live · Cloud connected"
      : connectionState === "connecting" || connectionState === "reconnecting"
        ? "Connecting to cloud…"
        : online
          ? "Realtime reconnecting…"
          : "Offline · cached mode";

  return (
    <DesktopAppShell title="Kitchen Display" subtitle={connectionLabel} onLogout={() => void logout()}>
      <div className="kds-shell h-full">
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
              <span>Connecting to cloud kitchen queue</span>
            </div>
          ) : activeOrders.length === 0 && readyOrders.length === 0 ? (
            <div className="kds-empty">
              <strong>No orders yet</strong>
              <span>Accepted orders appear automatically when cashier accepts them</span>
            </div>
          ) : (
            <>
              {activeOrders.length > 0 ? (
                <section className="kds-grid" aria-label="Active kitchen orders">
                  {activeOrders.map((order) => (
                    <OrderCard
                      key={order.orderId}
                      order={order}
                      isNew={newOrderIds.has(order.orderId)}
                      onPreparing={() => void markPreparing(order)}
                      onReady={() => void markReady(order)}
                    />
                  ))}
                </section>
              ) : null}

              {readyOrders.length > 0 ? (
                <section style={{ marginTop: "1.25rem" }}>
                  <h2 style={{ margin: "0 0 0.85rem", color: "#94a3b8", fontSize: "0.95rem" }}>
                    Ready for pickup
                  </h2>
                  <div className="kds-grid" aria-label="Ready orders">
                    {readyOrders.map((order) => (
                      <OrderCard
                        key={order.orderId}
                        order={order}
                        isNew={false}
                        onPreparing={() => void markPreparing(order)}
                        onReady={() => void markReady(order)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </main>
      </div>
    </DesktopAppShell>
  );
}

type OrderCardProps = {
  order: KitchenOrder;
  isNew: boolean;
  onPreparing: () => void;
  onReady: () => void;
};

function OrderCard({ order, isNew, onPreparing, onReady }: OrderCardProps) {
  const canMarkPreparing = order.status === "accepted";
  const canMarkReady = order.status === "preparing";

  return (
    <article
      className={`kds-card status-${order.status}${isNew ? " new" : ""}`}
      aria-label={`Order ${order.orderNumber}`}
    >
      <div className="kds-card-header">
        <div>
          <div className="kds-order-number">{order.orderNumber}</div>
          <div className="kds-meta-row">
            <span className="kds-chip source">{formatSource(order.source)}</span>
            {order.tableNumber ? (
              <span className="kds-chip table">Table {order.tableNumber}</span>
            ) : null}
            <span className="kds-chip">{formatTime(order.createdAt)}</span>
          </div>
        </div>
        <span className={`kds-status-badge ${order.status}`}>{order.status}</span>
      </div>

      <ul className="kds-items">
        {order.items.map((item) => (
          <li key={`${order.orderId}-${item.productId}-${item.name}`} className="kds-item">
            <div>
              <div className="kds-item-name">{item.name}</div>
              {item.notes ? <div className="kds-item-note">{item.notes}</div> : null}
            </div>
            <div className="kds-item-qty">×{item.quantity}</div>
          </li>
        ))}
      </ul>

      {order.specialNotes ? (
        <div className="kds-notes">
          <strong>Special notes:</strong> {order.specialNotes}
        </div>
      ) : null}

      <div className="kds-actions">
        <button
          type="button"
          className="kds-action-btn preparing"
          disabled={!canMarkPreparing}
          onClick={onPreparing}
        >
          Mark as Preparing
        </button>
        <button
          type="button"
          className="kds-action-btn ready"
          disabled={!canMarkReady}
          onClick={onReady}
        >
          Mark as Ready
        </button>
      </div>
    </article>
  );
}
