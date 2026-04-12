import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring
} from "react-native-reanimated";
import { staffColors } from "../../theme/staff-ui";

type Props = {
  itemCount: number;
  total: number;
  onPress: () => void;
  hidden?: boolean;
};

export function FloatingCartButton({ itemCount, total, onPress, hidden }: Props) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (itemCount > 0) {
      scale.value = withSequence(withSpring(1.08, { damping: 12 }), withSpring(1, { damping: 14 }));
    }
  }, [itemCount, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  if (hidden) return null;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          right: 16,
          bottom: Math.max(20, insets.bottom + 8),
          zIndex: 50
        },
        animStyle
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderRadius: 999,
          backgroundColor: staffColors.accent,
          opacity: pressed ? 0.92 : 1,
          shadowColor: staffColors.accent,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 8
        })}
      >
        <Text style={{ fontSize: 20 }}>🛒</Text>
        <View>
          <Text style={{ color: "white", fontWeight: "900", fontSize: 15 }}>Cart</Text>
          <Text style={{ color: "rgba(255,255,255,0.92)", fontWeight: "700", fontSize: 12 }}>
            {itemCount > 0 ? `${itemCount} items · ₹${total.toFixed(0)}` : "Tap to open"}
          </Text>
        </View>
        {itemCount > 0 ? (
          <View
            style={{
              minWidth: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: "white",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 6
            }}
          >
            <Text style={{ color: staffColors.accent, fontWeight: "900", fontSize: 13 }}>{itemCount > 99 ? "99+" : itemCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}
