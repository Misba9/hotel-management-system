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
          paddingVertical: layout.isTablet ? posSpacing.md : posSpacing.sm,
          minHeight: layout.isTablet ? layout.buttonHeight + 16 : undefined,
          gap: layout.isTablet ? posSpacing.md : posSpacing.sm
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
    justifyContent: "flex-start",
    flexWrap: "wrap",
    backgroundColor: posColors.secondary,
    borderTopWidth: 1,
    borderTopColor: posColors.borderStrong,
    width: "100%"
  }
});
