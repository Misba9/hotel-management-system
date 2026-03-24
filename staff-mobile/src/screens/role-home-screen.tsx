import React, { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import {
  CashierPanel,
  DeliveryPanel,
  KitchenPanel,
  ManagerPanel,
  WaiterPanel
} from "../components/role-panels";

const roles = ["Delivery Boy", "Kitchen Staff", "Waiter", "Cashier", "Manager"] as const;
type Role = (typeof roles)[number];

export function RoleHomeScreen() {
  const [role, setRole] = useState<Role>("Kitchen Staff");
  const content = useMemo(() => {
    switch (role) {
      case "Delivery Boy":
        return <DeliveryPanel />;
      case "Kitchen Staff":
        return <KitchenPanel />;
      case "Waiter":
        return <WaiterPanel />;
      case "Cashier":
        return <CashierPanel />;
      case "Manager":
        return <ManagerPanel />;
      default:
        return null;
    }
  }, [role]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#FFF8F3", padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 12 }}>Role-based Staff App</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        {roles.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => setRole(option)}
            style={{
              marginRight: 8,
              borderRadius: 20,
              backgroundColor: role === option ? "#FF6B35" : "white",
              paddingHorizontal: 14,
              paddingVertical: 8
            }}
          >
            <Text style={{ color: role === option ? "white" : "#111827" }}>{option}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {content}
    </ScrollView>
  );
}
