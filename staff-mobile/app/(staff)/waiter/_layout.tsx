import React from "react";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../../src/context/AuthProvider";
import { StaffLoadingView } from "../../../src/components/staff-dashboard/staff-loading-view";
import { isPendingApprovalGate } from "../../../src/navigation/staff-role-routes";

/**
 * Expo Router shell for `/waiter/*`: **waiter role only**, active account.
 * - Signed out → `/` → root app shows **Login**.
 * - Wrong role → `/` → that user’s role home (not waiter).
 * - Pending / paused / sync error → `/` for the appropriate gate UI.
 */
export default function WaiterLayout() {
  const { user, staff, loading, gate } = useAuth();

  if (loading) {
    return <StaffLoadingView message="Loading your access…" />;
  }

  if (!user || isPendingApprovalGate(gate) || gate === "paused" || gate === "sync_error") {
    return <Redirect href="/" />;
  }

  if (gate !== "active" || staff?.role !== "waiter") {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: "#FF6B35",
        headerTitleStyle: { fontWeight: "700" },
        headerBackTitleVisible: false
      }}
    />
  );
}
