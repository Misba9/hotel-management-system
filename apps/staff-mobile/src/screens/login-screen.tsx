import React, { useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState("");

  const handleOtp = () => {
    if (!phone.trim()) {
      Alert.alert("Phone number required");
      return;
    }
    navigation.navigate("Home");
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 16, backgroundColor: "#FFF8F3" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>OTP Login</Text>
      <TextInput
        placeholder="+91 9XXXXXXXXX"
        value={phone}
        onChangeText={setPhone}
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12, marginBottom: 16 }}
      />
      <Button title="Send OTP" onPress={handleOtp} color="#FF6B35" />
    </View>
  );
}
