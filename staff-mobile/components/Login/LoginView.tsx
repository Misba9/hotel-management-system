import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { FirebaseError } from "firebase/app";
import { useRouter } from "expo-router";

import { fetchStaffProfileAfterAuth } from "../../services/staff-profile";
import { staffAuth } from "../../src/lib/firebase";
import { useAuthStore } from "../../store/useAuthStore";

function friendlyAuthMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/user-disabled":
        return "This account has been disabled.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Wrong email or password.";
      case "auth/network-request-failed":
        return "Network error. Check your connection.";
      default:
        return err.message || "Sign-in failed.";
    }
  }
  if (err instanceof Error) return err.message;
  return "Login failed.";
}

export function LoginView() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Enter your staff email and password.");
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
      const u = staffAuth.currentUser;
      if (!u) {
        throw new Error("No user after sign-in.");
      }

      const staff = await fetchStaffProfileAfterAuth(u);
      if (!staff.ok) {
        await logout();
        Alert.alert("Cannot continue", staff.reason);
        return;
      }

      setUser(u, staff.profile.role, staff.profile.name);
      router.replace("/");
    } catch (e) {
      Alert.alert("Login failed", friendlyAuthMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.kicker}>STAFF APP</Text>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.lead}>
          After Firebase Auth, your role is read from Firestore{" "}
          <Text style={styles.bold}>staff_users</Text> (alias <Text style={styles.bold}>staffUsers</Text>) and stored
          for routing.
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          placeholder="you@restaurant.com"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          editable={!busy}
          style={styles.input}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          placeholder="••••••••"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!busy}
          style={styles.input}
        />

        <Pressable
          onPress={() => void onSubmit()}
          disabled={busy}
          style={({ pressed }) => [styles.primary, (pressed || busy) && { opacity: 0.9 }, busy && { opacity: 0.7 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Continue</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: "#2563eb", marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  lead: { fontSize: 15, color: "#64748b", marginBottom: 28, lineHeight: 22 },
  bold: { fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "600", color: "#0f172a", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#fff",
    marginBottom: 18
  },
  primary: {
    marginTop: 8,
    backgroundColor: "#0f172a",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center"
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" }
});
