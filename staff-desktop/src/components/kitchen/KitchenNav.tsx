import type { KitchenStage } from "@/lib/kitchen-order-mapper";
import type { KitchenNavCounts } from "@/hooks/useKitchenNavCounts";

type KitchenNavProps = {
  stage: KitchenStage;
  counts: KitchenNavCounts;
  onStageChange: (stage: KitchenStage) => void;
};

const TABS: Array<{ id: KitchenStage; label: string; countKey?: keyof KitchenNavCounts }> = [
  { id: "active", label: "Orders", countKey: "active" },
  { id: "ready", label: "Ready", countKey: "ready" },
  { id: "history", label: "History" }
];

export function KitchenNav({ stage, counts, onStageChange }: KitchenNavProps) {
  return (
    <nav className="kds-nav" aria-label="Kitchen workflow">
      {TABS.map((tab) => {
        const count = tab.countKey ? counts[tab.countKey] : null;
        const active = stage === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`kds-nav-tab${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => onStageChange(tab.id)}
          >
            <span>{tab.label}</span>
            {count != null && count > 0 ? (
              <span className="kds-nav-badge" aria-label={`${count} orders`}>
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
