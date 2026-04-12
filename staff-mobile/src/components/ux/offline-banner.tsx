import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "../../hooks/use-network-status";
/**
 * Floating banner when the device has no usable network (native; hidden on web if NetInfo is limited).
 */
export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          paddingTop: Platform.OS === "web" ? 8 : Math.max(insets.top, 8)
        }
      ]}
    >
      <View style={styles.pill}>
        <Text style={styles.title}>No connection</Text>
        <Text style={styles.sub}>{`Orders and updates will sync when you're back online.`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 1000,
    alignItems: "center",
    paddingHorizontal: 12
  },
  pill: {
    maxWidth: 400,
    width: "100%",
    backgroundColor: "#1e293b",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#334155",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8
      },
      android: { elevation: 6 },
      default: {}
    })
  },
  title: {
    color: "#f8fafc",
    fontWeight: "800",
    fontSize: 14,
    textAlign: "center"
  },
  sub: {
    marginTop: 4,
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center"
  }
});
