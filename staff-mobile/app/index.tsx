import React from "react";
import { AppNavigator } from "../src/navigation/AppNavigator";

/**
 * Legacy role roots (admin, manager, kitchen, …) stay on React Navigation until migrated to Expo Router.
 */
export default function IndexRoute() {
  return <AppNavigator />;
}
