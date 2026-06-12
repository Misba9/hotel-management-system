import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle
} from "react-native";
import { posColors, posFont, posRadius, posShadow, posSpacing, posType } from "./pos-theme";
import { PosIcon, type PosIconName } from "./pos-icons";

type ChipProps = {
  label: string;
  active?: boolean;
  color?: string;
  onPress?: () => void;
  icon?: PosIconName;
};

export function PosChip({ label, active, color = posColors.primary, onPress, icon }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: color, borderColor: color },
        !active && pressed && { backgroundColor: posColors.cardHover }
      ]}
    >
      {icon ? <PosIcon name={icon} size={12} color={active ? "#fff" : posColors.textSecondary} /> : null}
      <Text style={[styles.chipText, active && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

type BtnProps = PressableProps & {
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: PosIconName;
  loading?: boolean;
  fullWidth?: boolean;
};

export function PosButton({ label, variant = "primary", icon, loading, fullWidth, disabled, style, ...rest }: BtnProps) {
  const bg =
    variant === "primary"
      ? posColors.success
      : variant === "danger"
        ? posColors.danger
        : variant === "ghost"
          ? "transparent"
          : posColors.card;
  const border = variant === "secondary" ? posColors.borderStrong : "transparent";
  const textColor = variant === "secondary" || variant === "ghost" ? posColors.text : "#fff";

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        fullWidth && { flex: 1 },
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.92 : 1 },
        pressed && { transform: [{ scale: 0.98 }] },
        style as ViewStyle
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon ? <PosIcon name={icon} size={16} color={textColor} /> : null}
          <Text style={[styles.btnText, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export const PosInput = React.forwardRef<TextInput, TextInputProps>(function PosInput({ style, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={posColors.textDim}
      style={[styles.input, style]}
      {...props}
    />
  );
});

export function PosDivider() {
  return <View style={styles.divider} />;
}

export function PosSectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={posType.label}>{title}</Text>
      {action}
    </View>
  );
}

export function PosBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function PosEmpty({ message, hint }: { message: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={posType.h3}>{message}</Text>
      {hint ? <Text style={[posType.small, { marginTop: posSpacing.sm, textAlign: "center" }]}>{hint}</Text> : null}
    </View>
  );
}

/** Web hover lift wrapper for cards */
export function PosHoverCard({
  children,
  selected,
  onPress,
  style
}: {
  children: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      {...(Platform.OS === "web"
        ? { onHoverIn: () => setHovered(true), onHoverOut: () => setHovered(false) }
        : {})}
      style={[
        styles.hoverCard,
        selected && styles.hoverCardSelected,
        hovered && !selected && styles.hoverCardHover,
        style
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: posRadius.pill,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border
  },
  chipText: { ...posFont, fontSize: 12, fontWeight: "700", color: posColors.textSecondary },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: posRadius.md,
    borderWidth: 1
  },
  btnText: { ...posFont, fontSize: 14, fontWeight: "800" },
  input: {
    ...posFont,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border,
    borderRadius: posRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: posColors.text
  },
  divider: { height: 1, backgroundColor: posColors.border, marginVertical: posSpacing.md },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: posSpacing.sm
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: posRadius.pill,
    borderWidth: 1
  },
  badgeText: { ...posFont, fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  empty: { alignItems: "center", justifyContent: "center", padding: posSpacing.xxxl },
  hoverCard: {
    backgroundColor: posColors.card,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.border,
    ...posShadow(false)
  },
  hoverCardSelected: {
    borderColor: posColors.primary,
    backgroundColor: posColors.primaryMuted,
    ...Platform.select({
      web: { boxShadow: `0 0 0 1px ${posColors.primary}, 0 8px 24px ${posColors.glow}` } as ViewStyle,
      default: {}
    })
  },
  hoverCardHover: Platform.select({
    web: { transform: [{ translateY: -2 }], backgroundColor: posColors.cardHover } as ViewStyle,
    default: { backgroundColor: posColors.cardHover }
  })
});
