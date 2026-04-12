import React from "react";
import { Platform, TextInput, View } from "react-native";
import { staffColors } from "../../theme/staff-ui";

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChangeText, placeholder = "Search menu…" }: Props) {
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: staffColors.border,
          backgroundColor: staffColors.surface,
          paddingHorizontal: 16,
          paddingVertical: Platform.OS === "web" ? 14 : 12,
          fontSize: 16,
          color: staffColors.text,
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2
        }}
      />
    </View>
  );
}
