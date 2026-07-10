import { Redirect } from "expo-router";

/** Signup is the Email tab in signup mode (matches customer-web). */
export default function SignupRedirect() {
  return <Redirect href={{ pathname: "/auth/login", params: { tab: "email", mode: "signup" } }} />;
}
