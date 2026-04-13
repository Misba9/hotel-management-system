import React from "react";
import { Text, View } from "react-native";
import { useStaffAuth } from "../context/staff-auth-context";

/**
 * Shown when `staff_users` is still pending / needs assignment, or when `users/{uid}` blocks access
 * (`approved: false` or `pendingApproval: true`).
 */
export function PendingApprovalScreen() {
  const { signOutUser, pendingApprovalReason, usersFirestore } = useStaffAuth();

  const fromUsersDoc = pendingApprovalReason === "users_doc";

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 28, backgroundColor: "#FFF8F3" }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: "#FEF3C7",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16
        }}
      >
        <Text style={{ fontSize: 28 }}>⏳</Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: "800", color: "#92400E", textAlign: "center" }}>
        Pending approval
      </Text>
      {fromUsersDoc ? (
        <Text style={{ marginTop: 12, color: "#64748b", textAlign: "center", lineHeight: 22, fontSize: 15 }}>
          Your profile in <Text style={{ fontWeight: "700" }}>users</Text> is not approved yet. An administrator must set{" "}
          <Text style={{ fontWeight: "700" }}>approved: true</Text> (and clear pending approval) before you can use the app.
        </Text>
      ) : (
        <Text style={{ marginTop: 12, color: "#64748b", textAlign: "center", lineHeight: 22, fontSize: 15 }}>
          Your account is registered with <Text style={{ fontWeight: "700" }}>role: pending</Text>. An administrator must assign
          your role and set <Text style={{ fontWeight: "700" }}>isActive: true</Text> in the admin panel.
        </Text>
      )}
      {usersFirestore?.loaded && usersFirestore.docExists ? (
        <Text style={{ marginTop: 14, color: "#475569", textAlign: "center", fontSize: 13, lineHeight: 20 }}>
          Firestore users: role{" "}
          <Text style={{ fontWeight: "700" }}>{usersFirestore.role ?? "—"}</Text>
          {" · "}
          approved{" "}
          <Text style={{ fontWeight: "700" }}>
            {usersFirestore.approved === null ? "—" : usersFirestore.approved ? "yes" : "no"}
          </Text>
        </Text>
      ) : usersFirestore?.loaded && !usersFirestore.docExists ? (
        <Text style={{ marginTop: 14, color: "#94a3b8", textAlign: "center", fontSize: 12 }}>
          No <Text style={{ fontWeight: "600" }}>users</Text> profile document yet (staff record only).
        </Text>
      ) : null}
      <Text style={{ marginTop: 16, color: "#0f172a", fontSize: 13, fontWeight: "600", textAlign: "center" }}>
        Stay on this screen — it updates automatically when you are approved. No need to sign out and back in.
      </Text>
      <Text style={{ marginTop: 12, color: "#94a3b8", fontSize: 12, textAlign: "center" }}>
        Listening for Firestore updates in real time.
      </Text>
      <Text onPress={() => void signOutUser()} style={{ marginTop: 28, color: "#FF6B35", fontWeight: "700", fontSize: 16 }}>
        Sign out
      </Text>
    </View>
  );
}
