import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { AppNavigator } from "../src/navigation/AppNavigator";

/**
 * Expo Router already mounts a root `NavigationContainer`. This legacy React Navigation tree
 * must use an independent container so it is not nested under Expo Router's.
 */
export default function IndexRoute() {
  return (
    <NavigationContainer independent>
      <AppNavigator />
    </NavigationContainer>
  );
}
