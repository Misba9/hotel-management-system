import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";

type Props = { width?: number | `${number}%`; height?: number; style?: ViewStyle; borderRadius?: number };

export function Skeleton({ width = "100%", height = 16, style, borderRadius = 8 }: Props) {
  const colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true })
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity
        },
        style
      ]}
    />
  );
}

export function ProductCardSkeleton() {
  const colors = useThemeColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton height={120} borderRadius={12} />
      <View style={styles.body}>
        <Skeleton height={14} width="70%" />
        <Skeleton height={12} width="40%" style={{ marginTop: 8 }} />
        <Skeleton height={16} width="30%" style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden", flex: 1, margin: 6 },
  body: { padding: 12 }
});
