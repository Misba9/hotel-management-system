import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { AppNavigator } from "../src/navigation/AppNavigator";

/** Role roots use React Navigation until fully on Expo Router. With `expo-router/entry`, wrap the stack here (App.tsx is unused). */
export default function IndexRoute() {
  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}
