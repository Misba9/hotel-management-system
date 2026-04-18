import React from "react";
import { Redirect } from "expo-router";

/**
 * Replaces the legacy React Navigation waiter stack: approved waiters land in Expo Router `app/(staff)/waiter/*`.
 */
export function WaiterExpoRouterEntry() {
  return <Redirect href="/waiter/floor" />;
}
