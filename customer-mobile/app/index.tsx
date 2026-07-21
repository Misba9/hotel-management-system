import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useAuth } from "@/src/context/auth-context";
import { useThemeColors } from "@shared/theme/react-native/MobileThemeProvider";

const CUSTOMER_LOGO = require("../assets/customer-mobile-logo.png");

export default function SplashScreen() {
  const router = useRouter();
  const { authReady, isAuthenticated } = useAuth();
  const colors = useThemeColors();

  useEffect(() => {
    if (!authReady) return;
    const timer = setTimeout(() => {
      router.replace(isAuthenticated ? "/(tabs)/home" : "/auth/login");
    }, 1500);
    return () => clearTimeout(timer);
  }, [authReady, isAuthenticated, router]);

  return (
    <LinearGradient colors={[colors.primary, "#1a1f2e", colors.background]} style={styles.wrap}>
      <Animated.View entering={FadeIn.duration(800)} style={styles.center}>
        <View style={styles.logo}>
          <Image source={CUSTOMER_LOGO} style={styles.logoImage} contentFit="cover" accessibilityLabel="Nausheen Fruits logo" />
        </View>
        <Animated.Text entering={FadeInDown.delay(300).duration(600)} style={[styles.title, { color: "#fff" }]}>
          Nausheen Fruits
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(500).duration(600)} style={styles.sub}>
          Fresh fruits, delivered fast
        </Animated.Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  center: { alignItems: "center" },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 20
  },
  logoImage: {
    width: "100%",
    height: "100%"
  },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  sub: { fontSize: 15, color: "rgba(255,255,255,0.75)", marginTop: 8 }
});
