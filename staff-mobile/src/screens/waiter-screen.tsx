import React from "react";
import { ScrollView } from "react-native";
import { WaiterPanel } from "../components/role-panels";
import { FeatureGate, NoAccessView } from "../components/feature-gate";
import { StaffScreenHeader } from "../components/staff-dashboard/staff-screen-header";
import { staffColors } from "../theme/staff-ui";

export function WaiterScreen() {
  return (
    <FeatureGate feature="waiter_table" fallback={<NoAccessView subtitle="Table ordering is not available for your role." />}>
      <ScrollView style={{ flex: 1, backgroundColor: staffColors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <StaffScreenHeader role="waiter" title="Floor service" subtitle="Tables, menu, and place orders." />
        <WaiterPanel />
      </ScrollView>
    </FeatureGate>
  );
}
