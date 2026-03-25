import React, { useState } from "react";
import { ActivityIndicator, Alert, Button, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useStaffAuth } from "../context/staff-auth-context";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

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
      const message = e instanceof Error ? e.message : "Login failed.";
      Alert.alert("Login failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 16, backgroundColor: "#FFF8F3" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 8 }}>Staff sign in</Text>
      <Text style={{ color: "#64748b", marginBottom: 16, fontSize: 14 }}>
        Use the email and password provisioned by your manager. Your role is loaded from your account after login.
      </Text>
      <TextInput
        placeholder="staff@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: "white" }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12, marginBottom: 16, backgroundColor: "white" }}
      />
      {loading ? (
        <ActivityIndicator color="#FF6B35" />
      ) : (
        <Button title="Sign in" onPress={() => void handleLogin()} color="#FF6B35" />
      )}
    </View>
  );
}
