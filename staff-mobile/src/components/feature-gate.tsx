import React from "react";
import { Text, View } from "react-native";
import { useStaffAuth } from "../context/staff-auth-context";
import { hasPermission, type StaffFeature } from "../lib/rbac";

type Props = {
  feature: StaffFeature;
  children: React.ReactNode;
  /** Override default “No Access” UI */
  fallback?: React.ReactNode;
};

export function NoAccessView({ subtitle }: { subtitle?: string }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#FFF8F3" }}>
      <Text style={{ fontSize: 20, fontWeight: "800", color: "#b91c1c" }}>No Access</Text>
      {subtitle ? (
        <Text style={{ marginTop: 10, color: "#64748b", textAlign: "center", lineHeight: 20 }}>{subtitle}</Text>
      ) : (
        <Text style={{ marginTop: 10, color: "#64748b", textAlign: "center" }}>Your role cannot open this area.</Text>
      )}
    </View>
  );
}

/**
 * Renders `children` only if the signed-in staff role may access `feature`; otherwise shows “No Access”.
 */
export function FeatureGate({ feature, children, fallback }: Props) {
  const { staff } = useStaffAuth();
  const allowed = Boolean(staff && hasPermission(staff.role, feature));
  if (!allowed) {
    return <>{fallback ?? <NoAccessView />}</>;
  }
  return <>{children}</>;
}
