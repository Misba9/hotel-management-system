import { useEffect, useState } from "react";
import {
  formatElapsed,
  formatSource,
  formatTime,
  type KitchenOrder
} from "@/lib/kds-utils";
import { readyWaitIso, stageProgressIso } from "@/lib/kitchen-order-mapper";

function useTick(intervalMs = 30000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}

function OrderItemsList({ order }: { order: KitchenOrder }) {
  return (
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
  );
}

type NewOrderCardProps = {
  order: KitchenOrder;
  isNew: boolean;
  onAccept: () => void;
};

export function NewOrderCard({ order, isNew, onAccept }: NewOrderCardProps) {
  useTick();

  return (
    <article
      className={`kds-card status-new${isNew ? " new" : ""}`}
      aria-label={`New order ${order.orderNumber}`}
    >
      <div className="kds-card-header">
        <div>
          <div className="kds-order-number">{order.orderNumber}</div>
          <div className="kds-meta-row">
            <span className="kds-chip source">{formatSource(order.source)}</span>
            {order.tableNumber ? (
              <span className="kds-chip table">Table {order.tableNumber}</span>
            ) : null}
            <span className="kds-chip timer">{formatElapsed(order.createdAt)} ago</span>
          </div>
        </div>
        <span className="kds-status-badge pending">New</span>
      </div>

      <OrderItemsList order={order} />

      {order.specialNotes ? (
        <div className="kds-notes">
          <strong>Special instructions:</strong> {order.specialNotes}
        </div>
      ) : null}

      <div className="kds-actions">
        <button type="button" className="kds-action-btn accept" onClick={onAccept}>
          Accept
        </button>
      </div>
    </article>
  );
}

type PreparingOrderCardProps = {
  order: KitchenOrder;
  onPreparing: () => void;
  onReady: () => void;
};

export function PreparingOrderCard({ order, onPreparing, onReady }: PreparingOrderCardProps) {
  useTick();
  const progressFrom = stageProgressIso(order);
  const canMarkPreparing = order.status === "accepted";
  const canMarkReady = order.status === "preparing";

  return (
    <article className={`kds-card status-${order.status}`} aria-label={`Order ${order.orderNumber}`}>
      <div className="kds-card-header">
        <div>
          <div className="kds-order-number">{order.orderNumber}</div>
          <div className="kds-meta-row">
            <span className="kds-chip source">{formatSource(order.source)}</span>
            {order.tableNumber ? (
              <span className="kds-chip table">Table {order.tableNumber}</span>
            ) : null}
          </div>
        </div>
        <span className={`kds-status-badge ${order.status}`}>{order.status}</span>
      </div>

      <div className="kds-progress-timer" aria-live="polite">
        <span className="kds-progress-label">In progress</span>
        <strong>{formatElapsed(progressFrom)}</strong>
      </div>

      <OrderItemsList order={order} />

      {order.specialNotes ? (
        <div className="kds-notes">
          <strong>Notes:</strong> {order.specialNotes}
        </div>
      ) : null}

      <div className="kds-actions">
        <button
          type="button"
          className="kds-action-btn preparing"
          disabled={!canMarkPreparing}
          onClick={onPreparing}
        >
          Preparing
        </button>
        <button
          type="button"
          className="kds-action-btn ready"
          disabled={!canMarkReady}
          onClick={onReady}
        >
          Ready
        </button>
      </div>
    </article>
  );
}

type ReadyOrderCardProps = {
  order: KitchenOrder;
  onNotifyWaiter?: () => void;
  onPickedUp: () => void;
};

export function ReadyOrderCard({ order, onNotifyWaiter, onPickedUp }: ReadyOrderCardProps) {
  useTick();
  const waitingFrom = readyWaitIso(order);

  return (
    <article className="kds-card kds-ready-card status-ready" aria-label={`Ready order ${order.orderNumber}`}>
      <div className="kds-ready-hero">
        <span className="kds-ready-badge">READY</span>
        <span className="kds-ready-wait">Waiting {formatElapsed(waitingFrom)}</span>
      </div>

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
          {order.waiterName ? (
            <div className="kds-waiter-line">Waiter: {order.waiterName}</div>
          ) : null}
        </div>
      </div>

      <OrderItemsList order={order} />

      <div className="kds-actions">
        {onNotifyWaiter ? (
          <button type="button" className="kds-action-btn notify" onClick={onNotifyWaiter}>
            Notify Waiter
          </button>
        ) : null}
        <button type="button" className="kds-action-btn picked-up" onClick={onPickedUp}>
          Mark Picked Up
        </button>
      </div>
    </article>
  );
}
