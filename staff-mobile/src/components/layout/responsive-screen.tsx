import React from "react";
import { ScrollView, StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";

import { useResponsiveLayout } from "../../hooks/use-responsive-layout";

type ResponsiveScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** Override horizontal padding (defaults to responsive tier padding) */
  paddingHorizontal?: number;
} & Pick<ScrollViewProps, "refreshControl" | "keyboardShouldPersistTaps">;

/**
 * Full-bleed screen shell: flex 1, width 100%, responsive horizontal padding.
 * Avoids phone-only maxWidth containers and letterboxing on tablets.
 */
export function ResponsiveScreen({
  children,
  scroll = false,
  contentContainerStyle,
  style,
  paddingHorizontal,
  refreshControl,
  keyboardShouldPersistTaps
}: ResponsiveScreenProps) {
  const { padding, width } = useResponsiveLayout();
  const padX = paddingHorizontal ?? padding;

  if (scroll) {
    return (
      <ScrollView
        style={[styles.screen, style]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: padX, width: "100%", maxWidth: width },
          contentContainerStyle
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.screen, { paddingHorizontal: padX, width: "100%" }, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch"
  },
  scrollContent: {
    flexGrow: 1,
    width: "100%"
  }
});
