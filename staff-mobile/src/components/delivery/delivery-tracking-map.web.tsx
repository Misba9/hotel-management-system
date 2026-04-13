import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type LatLng = { lat: number; lng: number };

type Props = {
  customerDrop: LatLng;
  rider: LatLng | null;
  customerTitle?: string;
  customerDescription?: string;
  showRoute?: boolean;
  mapHeight: number;
};

/** Web: no react-native-maps / native bridge — show placeholder only. */
export function DeliveryTrackingMap({ mapHeight }: Props) {
  return <DeliveryMapWebPlaceholder height={mapHeight} />;
}

type WebPlaceholderProps = { height: number };

export function DeliveryMapWebPlaceholder({ height }: WebPlaceholderProps) {
  return (
    <View style={[styles.webPh, { height }]}>
      <Text style={styles.webEmoji}>🗺</Text>
      <Text style={styles.webText}>Live map is available on iOS / Android (Expo Go or dev build)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webPh: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF8F3"
  },
  webEmoji: { fontSize: 28, marginBottom: 6 },
  webText: { fontSize: 14, fontWeight: "700", color: "#64748b", textAlign: "center", paddingHorizontal: 16 }
});
