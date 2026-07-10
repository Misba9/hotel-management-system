import { Redirect, useLocalSearchParams } from "expo-router";

/** Deep-link friendly: OTP lives inside the login Phone tab (web parity). */
export default function OtpVerificationRedirect() {
  const params = useLocalSearchParams<{ phone?: string; autoSend?: string }>();
  return (
    <Redirect
      href={{
        pathname: "/auth/login",
        params: {
          tab: "phone",
          phone: params.phone || "",
          autoSend: params.autoSend === "0" ? "0" : "1"
        }
      }}
    />
  );
}
