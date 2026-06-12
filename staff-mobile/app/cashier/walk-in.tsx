import { Redirect } from "expo-router";

/** Legacy route — new orders start from POS Billing or Orders. */
export default function CashierWalkInRedirect() {
  return <Redirect href="/cashier/billing" />;
}
