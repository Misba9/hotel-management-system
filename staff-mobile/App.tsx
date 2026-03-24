import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RoleHomeScreen } from "./src/screens/role-home-screen";
import { LoginScreen } from "./src/screens/login-screen";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Staff Login" }} />
        <Stack.Screen name="Home" component={RoleHomeScreen} options={{ title: "Staff Dashboard" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
