import { useKitchenStageOrders, type KitchenNavCounts } from "./use-kitchen-stage-orders";

/** @deprecated Use counts from `useKitchenStageOrders` — single listener avoids Firestore assertion errors. */
export function useKitchenNavCounts(_enabled = true): KitchenNavCounts {
  return { active: 0, ready: 0 };
}

export type { KitchenNavCounts };
