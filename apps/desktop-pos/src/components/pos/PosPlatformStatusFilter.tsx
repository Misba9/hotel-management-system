import type { PlatformTab } from "@/lib/pos/cashier-pos-store";
import type { OrderStatusFilter } from "@/lib/pos/order-source";
import { PLATFORM_STATUS_OPTIONS } from "@/lib/pos/platform-status-filters";

type Props = {
  platform: PlatformTab;
  activeStatus: OrderStatusFilter;
  statusCounts: Record<OrderStatusFilter, number>;
  onStatusChange: (status: OrderStatusFilter) => void;
};

export function PosPlatformStatusFilter({ platform, activeStatus, statusCounts, onStatusChange }: Props) {
  const options = PLATFORM_STATUS_OPTIONS[platform];
  return (
    <div className="pos-status-filter">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`pos-status-chip${activeStatus === opt.id ? " active" : ""}`}
          onClick={() => onStatusChange(opt.id)}
        >
          {opt.label}
          <span className="pos-status-count">{statusCounts[opt.id] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
