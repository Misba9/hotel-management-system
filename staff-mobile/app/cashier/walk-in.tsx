import React from "react";

import { RestaurantPosOrderScreen } from "../../components/RestaurantPosOrderScreen";

export default function CashierWalkInScreen() {
  return (
    <RestaurantPosOrderScreen
      tableFirestoreId="walk_in"
      tableNumber={0}
      linkTable={false}
      headerLabel="Walk-in"
      confirmHint="Walk-in order — same flow as waiter: ticket opens, then goes straight to the kitchen queue."
    />
  );
}
