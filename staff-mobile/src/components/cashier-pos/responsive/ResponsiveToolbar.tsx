import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useResponsiveLayout } from "../../../hooks/use-responsive-layout";
import { posColors, posSpacing } from "../pos-theme";

type Props = {
  children: React.ReactNode;
};

/** Wraps bottom toolbar / shortcut bar with responsive padding and sizing */
export const ResponsiveToolbar = memo(function ResponsiveToolbar({ children }: Props) {
  const layout = useResponsiveLayout();

  return (
    <View
      style={[
        styles.bar,
        {
          paddingHorizontal: layout.padding,
          paddingVertical: layout.isTablet ? posSpacing.sm : posSpacing.xs,
          minHeight: layout.isTablet ? layout.minTouch : undefined
        }
      ]}
    >
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: posSpacing.md,
    backgroundColor: posColors.secondary,
    borderTopWidth: 1,
    borderTopColor: posColors.border
  }
});
