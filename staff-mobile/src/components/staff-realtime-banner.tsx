import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useStaffAuth } from "../context/staff-auth-context";
import { staffColors } from "../theme/staff-ui";

/**
 * Non-blocking notice when Firestore `staff_users` role changes while the user is signed in.
 */
export function StaffRealtimeBanner() {
  const { staffRealtimeBanner, dismissStaffRealtimeBanner } = useStaffAuth();

  useEffect(() => {
    if (!staffRealtimeBanner) return;
    const t = setTimeout(() => dismissStaffRealtimeBanner(), 5000);
    return () => clearTimeout(t);
  }, [staffRealtimeBanner, dismissStaffRealtimeBanner]);

  if (!staffRealtimeBanner) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        top: 8,
        zIndex: 9999,
        alignItems: "center"
      }}
    >
      <View
        style={{
          maxWidth: 480,
          width: "100%",
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderRadius: 14,
          backgroundColor: "#0f172a",
          paddingVertical: 12,
          paddingHorizontal: 14,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6
        }}
      >
        <Text style={{ flex: 1, color: "#fff", fontSize: 14, fontWeight: "600", lineHeight: 20 }}>{staffRealtimeBanner}</Text>
        <Pressable onPress={dismissStaffRealtimeBanner} hitSlop={8}>
          <Text style={{ color: staffColors.accent, fontWeight: "800", fontSize: 13 }}>OK</Text>
        </Pressable>
      </View>
    </View>
  );
}
