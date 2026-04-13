import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";

export type LatLng = { lat: number; lng: number };

type Props = {
  customerDrop: LatLng;
  rider: LatLng | null;
  customerTitle?: string;
  customerDescription?: string;
  showRoute?: boolean;
  mapHeight: number;
};

const DEFAULT_REGION: Region = {
  latitude: 12.9716,
  longitude: 77.5946,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06
};

export function DeliveryTrackingMap({
  customerDrop,
  rider,
  customerTitle = "Customer",
  customerDescription = "Drop-off",
  showRoute = true,
  mapHeight
}: Props) {
  const mapRef = useRef<MapView | null>(null);

  const fitMap = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const pts: { latitude: number; longitude: number }[] = [];
    pts.push({ latitude: customerDrop.lat, longitude: customerDrop.lng });
    if (rider) {
      pts.push({ latitude: rider.lat, longitude: rider.lng });
    }

    if (pts.length === 1) {
      map.animateToRegion(
        {
          latitude: pts[0].latitude,
          longitude: pts[0].longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04
        },
        280
      );
      return;
    }

    map.fitToCoordinates(pts, {
      edgePadding: { top: 52, right: 44, bottom: 44, left: 44 },
      animated: true
    });
  }, [customerDrop.lat, customerDrop.lng, rider?.lat, rider?.lng]);

  useEffect(() => {
    const t = requestAnimationFrame(() => fitMap());
    return () => cancelAnimationFrame(t);
  }, [fitMap]);

  const lineCoords =
    showRoute && rider
      ? [
          { latitude: rider.lat, longitude: rider.lng },
          { latitude: customerDrop.lat, longitude: customerDrop.lng }
        ]
      : [];

  return (
    <MapView
      ref={mapRef}
      style={[styles.map, { height: mapHeight }]}
      initialRegion={DEFAULT_REGION}
      onMapReady={fitMap}
      showsUserLocation={false}
      showsMyLocationButton={false}
      loadingEnabled
      mapType="standard"
    >
      <Marker
        coordinate={{ latitude: customerDrop.lat, longitude: customerDrop.lng }}
        title={customerTitle}
        description={customerDescription}
        pinColor="#E23744"
      />
      {rider ? (
        <Marker
          coordinate={{ latitude: rider.lat, longitude: rider.lng }}
          title="You"
          description="Delivery partner"
          pinColor="#2563EB"
        />
      ) : null}
      {lineCoords.length === 2 ? (
        <Polyline
          coordinates={lineCoords}
          strokeColor="#FF6B35"
          strokeWidth={4}
          lineDashPattern={[10, 6]}
          geodesic
        />
      ) : null}
    </MapView>
  );
}

type WebPlaceholderProps = { height: number };

export function DeliveryMapWebPlaceholder({ height }: WebPlaceholderProps) {
  return (
    <View style={[styles.webPh, { height }]}>
      <Text style={styles.webEmoji}>🗺</Text>
      <Text style={styles.webText}>Live map is available on iOS / Android</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { width: "100%" },
  webPh: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF8F3"
  },
  webEmoji: { fontSize: 28, marginBottom: 6 },
  webText: { fontSize: 14, fontWeight: "700", color: "#64748b" }
});
