import React from "react";
import { StyleSheet, Text } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthProvider";
import { WaiterDashboardScreen } from "../screens/waiter-dashboard-screen";
import { TableOrderScreen } from "../screens/table-order-screen";
import { TableOrderDetailScreen } from "../screens/table-order-detail-screen";
import { TableOrdersListScreen } from "../screens/table-orders-list-screen";
import { logError } from "../lib/error-logging";

export type WaiterStackParamList = {
  WaiterDashboard: undefined;
  TableOrdersList: { tableId: string; tableNumber: number };
  TableOrder: { tableId: string; tableNumber: number };
  TableOrderDetail: { orderId: string; tableNumber: number };
};

const Stack = createNativeStackNavigator<WaiterStackParamList>();

function SignOutHeaderButton() {
  const { signOutUser } = useAuth();
  return (
    <Text
      onPress={() => {
        void signOutUser().catch((e) => {
          logError("WaiterStack.SignOutHeaderButton", e);
        });
      }}
      style={styles.signOut}
    >
      Sign out
    </Text>
  );
}

export function WaiterStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="WaiterDashboard"
      screenOptions={{
        headerBackTitleVisible: false,
        headerTintColor: "#FF6B35",
        headerTitleStyle: { fontWeight: "700" }
      }}
    >
      <Stack.Screen
        name="WaiterDashboard"
        component={WaiterDashboardScreen}
        options={{
          title: "Floor",
          headerRight: () => <SignOutHeaderButton />
        }}
      />
      <Stack.Screen
        name="TableOrdersList"
        component={TableOrdersListScreen}
        options={({ route }) => ({
          title: `Table ${route.params.tableNumber} · Orders`,
          headerBackVisible: true
        })}
      />
      <Stack.Screen
        name="TableOrder"
        component={TableOrderScreen}
        options={({ route }) => ({
          title: `Table ${route.params.tableNumber}`,
          headerBackVisible: true
        })}
      />
      <Stack.Screen
        name="TableOrderDetail"
        component={TableOrderDetailScreen}
        options={({ route }) => ({
          title: `Table ${route.params.tableNumber} · Order`,
          headerBackVisible: true
        })}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  signOut: { marginRight: 16, color: "#FF6B35", fontWeight: "600" }
});
