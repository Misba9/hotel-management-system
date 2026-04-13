import React from "react";
import { ScrollView, Text, View } from "react-native";
import { KitchenPanel } from "../components/role-panels";
import { useStaffAuth } from "../context/staff-auth-context";
import type { StaffRoleId } from "../constants/staff-roles";

function roleLabel(role: StaffRoleId | null) {
  switch (role) {
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "cashier":
      return "Cashier";
    case "kitchen":
      return "Kitchen";
    case "delivery":
      return "Delivery";
    case "waiter":
      return "Waiter";
    default:
      return "Staff";
  }
}

/** Legacy combined home; prefer role-specific routes in App.tsx. */
export function RoleHomeScreen() {
  const { staff, role } = useStaffAuth();

  const content = (() => {
    switch (role) {
      case "kitchen":
        return <KitchenPanel />;
      case "admin":
      case "manager":
        return (
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#64748b" }}>Use the role-specific routes from the main app entry.</Text>
          </View>
        );
      case "cashier":
      case "delivery":
      case "waiter":
        return (
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#64748b" }}>Use Billing, Delivery, or Waiter from the main app entry.</Text>
          </View>
        );
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
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 4 }}>{roleLabel(staff?.role ?? role)} workspace</Text>
      <Text style={{ color: "#64748b", marginBottom: 16, fontSize: 13 }}>
        Signed in as {staff?.name ?? "—"} — features depend on your role.
      </Text>
      {content}
    </ScrollView>
  );
}
