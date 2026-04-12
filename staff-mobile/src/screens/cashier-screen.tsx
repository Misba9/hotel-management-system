import React from "react";
import { View } from "react-native";
import { FeatureGate, NoAccessView } from "../components/feature-gate";
import { staffColors } from "../theme/staff-ui";
import POSScreen from "./POSScreen";

/** Cashier POS — mock menu + cart; swap `POSScreen` body for Firebase-backed POS when ready. */
export function CashierScreen() {
  return (
    <FeatureGate feature="billing" fallback={<NoAccessView subtitle="Billing is not available for your role." />}>
      <View style={{ flex: 1, backgroundColor: staffColors.bg }}>
        <POSScreen />
      </View>
    </FeatureGate>
  );
}
