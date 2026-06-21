import type { WorkflowStatus } from "@/lib/pos/order-workflow-status";
import { WORKFLOW_STATUSES, WORKFLOW_STATUS_META } from "@/lib/pos/order-workflow-status";

type OrderTimelineProps = {
  current: WorkflowStatus;
  cancelled?: boolean;
};

export function OrderTimeline({ current, cancelled }: OrderTimelineProps) {
  const steps = cancelled
    ? (["new", "cancelled"] as WorkflowStatus[])
    : WORKFLOW_STATUSES.filter((s) => s !== "cancelled");

  const currentIdx = steps.indexOf(current);

  return (
    <div className="space-y-0">
      {steps.map((step, idx) => {
        const meta = WORKFLOW_STATUS_META[step];
        const done = idx < currentIdx || (idx === currentIdx && !cancelled);
        const active = idx === currentIdx;
        const isLast = idx === steps.length - 1;

        return (
          <div key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: active || done ? meta.color : "#E2E8F0",
                  color: active || done ? "#fff" : "#94A3B8"
                }}
              >
                {idx + 1}
              </div>
              {!isLast ? (
                <div
                  className="my-0.5 w-0.5 flex-1 min-h-[20px]"
                  style={{ backgroundColor: done && idx < currentIdx ? meta.color : "#E2E8F0" }}
                />
              ) : null}
            </div>
            <div className={`pb-4 ${isLast ? "pb-0" : ""}`}>
              <p
                className="text-sm font-bold"
                style={{ color: active ? meta.color : done ? "#334155" : "#94A3B8" }}
              >
                {meta.label}
              </p>
              {active ? <p className="text-[11px] text-slate-500">Current stage</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
