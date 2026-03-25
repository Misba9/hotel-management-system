import React, { useEffect } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RoleHomeScreen } from "./src/screens/role-home-screen";
import { LoginScreen } from "./src/screens/login-screen";
import { StaffAuthProvider, useStaffAuth } from "./src/context/staff-auth-context";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function SignOutHeaderButton() {
  const { signOutUser } = useStaffAuth();
  return (
    <TouchableOpacity onPress={() => void signOutUser()} style={{ marginRight: 16 }}>
      <Text style={{ color: "#FF6B35", fontWeight: "600" }}>Sign out</Text>
    </TouchableOpacity>
  );
}

function AppNavigator() {
  const { user, role, loading, signOutUser } = useStaffAuth();

  useEffect(() => {
    if (user && role === "customer") {
      void (async () => {
        await signOutUser();
        Alert.alert("Access denied", "This account does not have staff access. Ask an admin to assign a staff role.");
      })();
    }
  }, [user, role, signOutUser]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF8F3" }}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={{ marginTop: 12, color: "#64748b" }}>Loading session…</Text>
      </View>
    );
  }

  const staffAllowed =
    role === "kitchen_staff" ||
    role === "waiter" ||
    role === "cashier" ||
    role === "delivery_boy" ||
    role === "manager" ||
    role === "admin";

  return (
    <Stack.Navigator>
      {user && staffAllowed ? (
        <Stack.Screen
          name="Home"
          component={RoleHomeScreen}
          options={{
            title: "Staff Dashboard",
            headerRight: () => <SignOutHeaderButton />
          }}
        />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Staff Login" }} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <StaffAuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </StaffAuthProvider>
  );
}
