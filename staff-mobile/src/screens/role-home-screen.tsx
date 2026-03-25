import React from "react";
import { ScrollView, Text, View } from "react-native";
import {
  CashierPanel,
  DeliveryPanel,
  KitchenPanel,
  ManagerPanel,
  WaiterPanel
} from "../components/role-panels";
import { useStaffAuth, type StaffRole } from "../context/staff-auth-context";

function roleLabel(role: StaffRole | null) {
  switch (role) {
    case "delivery_boy":
      return "Delivery";
    case "kitchen_staff":
      return "Kitchen";
    case "waiter":
      return "Waiter";
    case "cashier":
      return "Counter / POS";
    case "manager":
      return "Manager";
    case "admin":
      return "Admin";
    default:
      return "Staff";
  }
}

export function RoleHomeScreen() {
  const { role } = useStaffAuth();

  const content = (() => {
    switch (role) {
      case "delivery_boy":
        return <DeliveryPanel />;
      case "kitchen_staff":
        return <KitchenPanel />;
      case "waiter":
        return <WaiterPanel />;
      case "cashier":
        return <CashierPanel />;
      case "manager":
      case "admin":
        return <ManagerPanel />;
      default:
        return (
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#64748b" }}>No panel is available for this account.</Text>
          </View>
        );
    }
  })();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#FFF8F3", padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 4 }}>{roleLabel(role)} workspace</Text>
      <Text style={{ color: "#64748b", marginBottom: 16, fontSize: 13 }}>
        Signed in as {role?.replace(/_/g, " ") ?? "—"} — only features for your role are shown.
      </Text>
      {content}
    </ScrollView>
  );
}
