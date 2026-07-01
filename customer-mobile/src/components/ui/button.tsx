import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type ViewStyle } from "react-native";

type Props = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ title, loading, variant = "primary", disabled, style, ...rest }: Props) {
  const colors = useThemeColors();
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => {
        const base: ViewStyle[] = [
          styles.base,
          isPrimary ? { backgroundColor: colors.primary } : {},
          variant === "secondary"
            ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }
            : {},
          isGhost ? { backgroundColor: "transparent" } : {},
          (disabled || loading) ? styles.disabled : {},
          pressed ? styles.pressed : {}
        ];
        if (typeof style === "function") return [...base, style({ pressed })];
        return [...base, style];
      }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? "#fff" : colors.primary} />
      ) : (
        <Text
          style={[
            styles.text,
            { color: isPrimary ? "#fff" : isGhost ? colors.primary : colors.textPrimary }
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  text: { fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] }
});
