import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { WaiterPanel } from "../components/role-panels";
import { FeatureGate, NoAccessView } from "../components/feature-gate";
import { StaffScreenHeader } from "../components/staff-dashboard/staff-screen-header";
import { space } from "../theme/design-tokens";
import { staffColors } from "../theme/staff-ui";

export function WaiterScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    if (reloadNonce === 0) return undefined;
    const t = setTimeout(() => setRefreshing(false), 600);
    return () => clearTimeout(t);
  }, [reloadNonce]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setReloadNonce((n) => n + 1);
  }, []);

  return (
    <FeatureGate feature="waiter_table" fallback={<NoAccessView subtitle="Table ordering is not available for your role." />}>
      <ScrollView
        style={{ flex: 1, backgroundColor: staffColors.bg }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={staffColors.accent}
            colors={[staffColors.accent]}
          />
        }
      >
        <StaffScreenHeader role="waiter" title="Floor service" subtitle="Tables, menu, and place orders. Pull to refresh menu." />
        <WaiterPanel reloadNonce={reloadNonce} />
      </ScrollView>
    </FeatureGate>
  );
}
