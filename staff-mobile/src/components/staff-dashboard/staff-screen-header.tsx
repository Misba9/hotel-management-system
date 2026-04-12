import React from "react";
import { Text, View } from "react-native";
import type { StaffRoleId } from "../../constants/staff-roles";
import { useStaffAuth } from "../../context/staff-auth-context";
import { roleAccent, rolePanelTitle, subtitleStyle, titleStyle } from "../../theme/staff-ui";

type Props = {
  role: StaffRoleId;
  /** Main heading (defaults to role panel title). */
  title?: string;
  subtitle?: string;
};

export function StaffScreenHeader({ role, title, subtitle }: Props) {
  const { staff } = useStaffAuth();
  const accent = roleAccent[role];
  const heading = title ?? rolePanelTitle[role];

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={titleStyle}>{heading}</Text>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: `${accent}18`
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "800", color: accent, letterSpacing: 0.5 }}>{role.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={subtitleStyle}>
        {subtitle ?? `Signed in as ${staff?.name ?? "—"}${staff?.email ? ` · ${staff.email}` : ""}`}
      </Text>
      <View style={{ marginTop: 10, height: 3, borderRadius: 999, backgroundColor: accent }} />
    </View>
  );
}
