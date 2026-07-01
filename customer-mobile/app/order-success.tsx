import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";
import { Button } from "@/src/components/ui/button";

export default function OrderSuccessScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <Animated.View entering={FadeInDown.duration(600)} style={styles.center}>
        <Text style={styles.emoji}>✅</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Order placed!</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          {orderId ? `Order #${orderId.slice(0, 8)}` : "Your order"} is confirmed. We'll start preparing it soon.
        </Text>
        <Button
          title="Track order"
          onPress={() =>
            router.replace({
              pathname: "/order-tracking",
              params: { orderId: orderId || "" }
            })
          }
          style={{ marginTop: 24, width: "100%" }}
        />
        <Button title="Back to home" variant="ghost" onPress={() => router.replace("/(tabs)/home")} style={{ marginTop: 12 }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: 32 },
  center: { alignItems: "center" },
  emoji: { fontSize: 64 },
  title: { fontSize: 28, fontWeight: "900", marginTop: 16 },
  sub: { fontSize: 15, textAlign: "center", marginTop: 8, lineHeight: 22 }
});
