import React, { useEffect } from "react";
import {
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { staffColors } from "../../theme/staff-ui";
import type { CartLine } from "./pos-types";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_HEIGHT = Math.min(SCREEN_H * 0.62, 520);

type Props = {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  total: number;
  onInc: (menuItemId: string) => void;
  onDec: (menuItemId: string) => void;
  onPlaceOrder: () => void;
  placing: boolean;
  canPlace: boolean;
};

export function CartBottomSheet({
  open,
  onClose,
  lines,
  total,
  onInc,
  onDec,
  onPlaceOrder,
  placing,
  canPlace
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SHEET_HEIGHT + 48);

  useEffect(() => {
    translateY.value = withSpring(open ? 0 : SHEET_HEIGHT + 48, {
      damping: 24,
      stiffness: 210,
      mass: 0.85
    });
  }, [open, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }]
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [SHEET_HEIGHT + 48, 0], [0, 0.5])
  }));

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
      pointerEvents={open ? "box-none" : "none"}
    >
      <Pressable
        accessibilityLabel="Close cart"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
        disabled={!open}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#0f172a" }, backdropStyle]} />
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            {
              minHeight: SHEET_HEIGHT,
              maxHeight: SHEET_HEIGHT + insets.bottom,
              backgroundColor: staffColors.surface,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              paddingTop: 10,
              paddingHorizontal: 16,
              paddingBottom: Math.max(insets.bottom, 14),
              shadowColor: "#0f172a",
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 20
            },
            sheetStyle
          ]}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#e2e8f0", alignSelf: "center", marginBottom: 12 }} />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontWeight: "900", fontSize: 20, color: staffColors.text }}>Your cart</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={{ padding: 4 }}>
              <Text style={{ fontSize: 26, color: staffColors.muted, fontWeight: "300", lineHeight: 28 }}>×</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={lines}
            keyExtractor={(l) => l.menuItemId}
            style={{ flexGrow: 0, flexShrink: 1, maxHeight: SHEET_HEIGHT - 220 }}
            ListEmptyComponent={
              <Text style={{ color: staffColors.muted, textAlign: "center", paddingVertical: 20 }}>Add items from the menu</Text>
            }
            renderItem={({ item }) => (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: staffColors.border,
                  gap: 8
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontWeight: "700", color: staffColors.text, fontSize: 14 }} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={{ color: staffColors.muted, fontSize: 11, marginTop: 2 }}>₹{item.unitPrice} × {item.qty}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={() => onDec(item.menuItemId)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      backgroundColor: staffColors.border,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Text style={{ fontWeight: "900", fontSize: 16 }}>−</Text>
                  </TouchableOpacity>
                  <Text style={{ fontWeight: "900", minWidth: 26, textAlign: "center", fontSize: 15, marginHorizontal: 6 }}>
                    {item.qty}
                  </Text>
                  <TouchableOpacity
                    onPress={() => onInc(item.menuItemId)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      backgroundColor: staffColors.info,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: "white", fontSize: 16 }}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontWeight: "900", fontSize: 14, color: staffColors.text, width: 72, textAlign: "right" }}>
                  ₹{(item.unitPrice * item.qty).toFixed(0)}
                </Text>
              </View>
            )}
          />

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 6,
              paddingTop: 12,
              borderTopWidth: 2,
              borderTopColor: staffColors.border
            }}
          >
            <Text style={{ fontWeight: "900", fontSize: 17, color: staffColors.text }}>Total</Text>
            <Text style={{ fontWeight: "900", fontSize: 22, color: staffColors.accent }}>₹{total.toFixed(0)}</Text>
          </View>

          <TouchableOpacity
            disabled={placing || !canPlace}
            onPress={onPlaceOrder}
            style={{
              marginTop: 12,
              borderRadius: 16,
              backgroundColor: placing || !canPlace ? "#cbd5e1" : staffColors.success,
              paddingVertical: 15,
              alignItems: "center"
            }}
          >
            <Text style={{ color: "white", fontWeight: "900", fontSize: 17 }}>{placing ? "Placing…" : "Place order"}</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
