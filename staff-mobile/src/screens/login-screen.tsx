import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View
} from "react-native";
import { FirebaseError } from "firebase/app";
import type { RootStackParamList } from "../../App";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useStaffAuth } from "../context/staff-auth-context";
import { staffColors } from "../theme/staff-ui";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

function friendlyAuthMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/api-key-not-valid":
      case "auth/invalid-api-key":
      case "auth/invalid-api-key-argument":
        return "Invalid API key: use the Web app apiKey from Firebase. Paste Web config into staff-mobile/.env and restart with a clean cache.";
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
      case "auth/too-many-requests":
        return "Too many attempts. Try again later.";
      default:
        return err.message || "Sign-in failed.";
    }
  }
  if (err instanceof Error) return err.message;
  return "Login failed.";
}

/**
 * Firebase email/password staff login. Role and access come from Firestore `staff_users/{uid}` (document id === Auth UID) after auth.
 */
export function LoginScreen(_props: Props) {
  const { signInWithEmail } = useStaffAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Enter your staff email and password.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (e) {
      Alert.alert("Login failed", friendlyAuthMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: staffColors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 32 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: staffColors.accent, marginBottom: 8 }}>
          HOTEL STAFF
        </Text>
        <Text style={{ fontSize: 28, fontWeight: "800", color: staffColors.text, marginBottom: 8 }}>Sign in</Text>
        <Text style={{ fontSize: 15, color: staffColors.muted, marginBottom: 28, lineHeight: 22 }}>
          Use your work email and password. Your role loads from Firestore after you sign in.
        </Text>

        <Text style={{ fontSize: 13, fontWeight: "600", color: staffColors.text, marginBottom: 6 }}>Email</Text>
        <TextInput
          placeholder="you@restaurant.com"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          style={{
            borderWidth: 1,
            borderColor: staffColors.border,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: staffColors.text,
            backgroundColor: staffColors.surface,
            marginBottom: 18
          }}
        />

        <Text style={{ fontSize: 13, fontWeight: "600", color: staffColors.text, marginBottom: 6 }}>Password</Text>
        <TextInput
          placeholder="••••••••"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          style={{
            borderWidth: 1,
            borderColor: staffColors.border,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: staffColors.text,
            backgroundColor: staffColors.surface,
            marginBottom: 24
          }}
        />

        <Pressable
          onPress={() => void handleLogin()}
          disabled={loading}
          style={({ pressed }) => ({
            borderRadius: 14,
            backgroundColor: loading ? "#fdba8c" : staffColors.accent,
            paddingVertical: 16,
            alignItems: "center",
            opacity: pressed && !loading ? 0.9 : 1
          })}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800" }}>Continue</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
