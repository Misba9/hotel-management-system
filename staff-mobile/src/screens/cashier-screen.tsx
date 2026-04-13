import React from "react";
import { View } from "react-native";
import { FeatureGate, NoAccessView } from "../components/feature-gate";
import { CashierTableQueuePanel } from "../components/cashier-pos";
import { staffColors } from "../theme/staff-ui";
import POSScreen from "./POSScreen";

/** Cashier — realtime table payment queue + walk-in POS. */
export function CashierScreen() {
  return (
    <FeatureGate feature="billing" fallback={<NoAccessView subtitle="Billing is not available for your role." />}>
      <View style={{ flex: 1, backgroundColor: staffColors.bg }}>
        <CashierTableQueuePanel />
        <View style={{ flex: 1, minHeight: 0 }}>
          <POSScreen />
        </View>
      </View>
    </FeatureGate>
  );
}
