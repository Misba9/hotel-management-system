import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  buildHubUrl,
  formatSource,
  formatTime,
  getStoredCashierIp,
  playNewOrderSound,
  setStoredCashierIp,
  type KitchenOrder,
  type KitchenOrderStatus,
  type OrderStatusUpdate
} from "@/lib/kds-utils";

type ConnectionState = "connecting" | "connected" | "disconnected";

export default function App() {
  const [cashierIp, setCashierIp] = useState(getStoredCashierIp);
  const [draftIp, setDraftIp] = useState(getStoredCashierIp);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set());
  const socketRef = useRef<Socket | null>(null);

  const hubUrl = useMemo(() => buildHubUrl(cashierIp), [cashierIp]);

  const upsertOrder = useCallback((order: KitchenOrder) => {
    setOrders((prev) => {
      const index = prev.findIndex((entry) => entry.orderId === order.orderId);
      if (index === -1) {
        return [order, ...prev];
      }
      const next = [...prev];
      next[index] = { ...next[index], ...order };
      return next;
    });
  }, []);

  const applyStatusUpdate = useCallback((update: OrderStatusUpdate) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.orderId === update.orderId ? { ...order, status: update.status } : order
      )
    );
  }, []);

  const connectToHub = useCallback((ip: string) => {
    const trimmed = ip.trim() || "localhost";
    setConnectionState("connecting");

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(buildHubUrl(trimmed), {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionState("connected");
    });

    socket.on("disconnect", () => {
      setConnectionState("disconnected");
    });

    socket.on("connect_error", () => {
      setConnectionState("disconnected");
    });

    socket.on("new-order", (order: KitchenOrder) => {
      upsertOrder({ ...order, status: order.status ?? "pending" });
      setNewOrderIds((prev) => new Set(prev).add(order.orderId));
      playNewOrderSound();
      window.setTimeout(() => {
        setNewOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(order.orderId);
          return next;
        });
      }, 2500);
    });

    socket.on("order-status-update", (update: OrderStatusUpdate) => {
      applyStatusUpdate(update);
    });
  }, [applyStatusUpdate, upsertOrder]);

  useEffect(() => {
    connectToHub(cashierIp);
    return () => {
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [cashierIp, connectToHub]);

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status !== "ready"),
    [orders]
  );

  const readyOrders = useMemo(
    () => orders.filter((order) => order.status === "ready"),
    [orders]
  );

  const updateStatus = (order: KitchenOrder, status: KitchenOrderStatus) => {
    upsertOrder({ ...order, status });
    socketRef.current?.emit("order-status-update", {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      status
    } satisfies OrderStatusUpdate);
  };

  const handleConnect = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = draftIp.trim() || "localhost";
    setStoredCashierIp(trimmed);
    setCashierIp(trimmed);
  };

  return (
    <div className="kds-shell">
      <header className="kds-topbar">
        <div className="kds-brand">
          <h1>Kitchen Display</h1>
          <span>Live orders from cashier POS · {hubUrl}</span>
        </div>

        <form className="kds-connect" onSubmit={handleConnect}>
          <input
            className="kds-input"
            value={draftIp}
            onChange={(event) => setDraftIp(event.target.value)}
            placeholder="Cashier IP (e.g. 192.168.1.42)"
            aria-label="Cashier IP address"
          />
          <button type="submit" className="kds-btn kds-btn-primary">
            Connect
          </button>
          <span
            className={`kds-status-pill ${connectionState === "connected" ? "online" : "offline"}`}
          >
            <span className="kds-status-dot" />
            {connectionState === "connected"
              ? "Connected"
              : connectionState === "connecting"
                ? "Connecting…"
                : "Disconnected"}
          </span>
        </form>
      </header>

      <main className="kds-main">
        {activeOrders.length === 0 && readyOrders.length === 0 ? (
          <div className="kds-empty">
            <strong>No orders yet</strong>
            <span>Waiting for new orders from the cashier terminal…</span>
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
                    onPreparing={() => updateStatus(order, "preparing")}
                    onReady={() => updateStatus(order, "ready")}
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
                      onPreparing={() => updateStatus(order, "preparing")}
                      onReady={() => updateStatus(order, "ready")}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

type OrderCardProps = {
  order: KitchenOrder;
  isNew: boolean;
  onPreparing: () => void;
  onReady: () => void;
};

function OrderCard({ order, isNew, onPreparing, onReady }: OrderCardProps) {
  const itemNotes = order.items.filter((item) => item.notes?.trim());

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
          <li key={`${order.orderId}-${item.productId}`} className="kds-item">
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

      {itemNotes.length > 0 && !order.specialNotes ? (
        <div className="kds-notes">
          <strong>Item notes:</strong>{" "}
          {itemNotes.map((item) => `${item.name}: ${item.notes}`).join(" · ")}
        </div>
      ) : null}

      <div className="kds-actions">
        <button
          type="button"
          className="kds-action-btn preparing"
          disabled={order.status === "preparing"}
          onClick={onPreparing}
        >
          Mark as Preparing
        </button>
        <button
          type="button"
          className="kds-action-btn ready"
          disabled={order.status === "ready"}
          onClick={onReady}
        >
          Mark as Ready
        </button>
      </div>
    </article>
  );
}
