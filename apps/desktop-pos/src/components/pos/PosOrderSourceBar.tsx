import { PLATFORM_TABS, type PlatformTab } from "@/lib/pos-theme";

type Props = {
  active: PlatformTab;
  counts: Record<PlatformTab, number>;
  onChange: (tab: PlatformTab) => void;
};

export function PosOrderSourceBar({ active, counts, onChange }: Props) {
  return (
    <div className="pos-source-bar">
      {PLATFORM_TABS.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`pos-source-tab${on ? " active" : ""}`}
            style={on ? { borderColor: tab.color, backgroundColor: "rgba(255,122,0,0.14)" } : undefined}
            onClick={() => onChange(tab.id)}
          >
            <span className="pos-source-emoji">{tab.emoji}</span>
            <span className="pos-source-label" style={on ? { color: tab.color } : undefined}>
              {tab.label}
            </span>
            <span
              className={`pos-source-count${on ? " active" : ""}`}
              style={on ? { backgroundColor: tab.color } : undefined}
            >
              {counts[tab.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
