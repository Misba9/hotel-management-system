import React from "react";
import { FeatureGate, NoAccessView } from "../../components/feature-gate";
import ManagerDashboard from "../ManagerDashboard";

/** Manager home — mock stats + Orders / Staff tabs (`ManagerDashboard.js`). */
export function ManagerDashboardScreen() {
  return (
    <FeatureGate feature="dashboard" fallback={<NoAccessView subtitle="You do not have access to the dashboard." />}>
      <ManagerDashboard />
    </FeatureGate>
  );
}
