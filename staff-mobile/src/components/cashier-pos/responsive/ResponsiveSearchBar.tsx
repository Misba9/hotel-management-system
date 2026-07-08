import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View, type TextInput, type ViewStyle } from "react-native";
import { useResponsiveLayout } from "../../../hooks/use-responsive-layout";
import { PosIcon } from "../pos-icons";
import { PosInput } from "../pos-ui";
import { posColors, posRadius, posSpacing } from "../pos-theme";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  onBarcodeScan?: () => void;
  searchInputRef?: React.Ref<TextInput>;
  headerAction?: React.ReactNode;
  orderToolbar?: React.ReactNode;
  suggestions?: string[];
  showSuggestions?: boolean;
  onSuggestionSelect?: (name: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

export const ResponsiveSearchBar = memo(function ResponsiveSearchBar({
  search,
  onSearchChange,
  onBarcodeScan,
  searchInputRef,
  headerAction,
  orderToolbar,
  suggestions = [],
  showSuggestions = false,
  onSuggestionSelect,
  onFocus,
  onBlur
}: Props) {
  const layout = useResponsiveLayout();
  const pad = layout.padding;

  const rowStyle: ViewStyle =
    layout.isLargeTablet
      ? styles.rowLargeTablet
      : layout.isTablet
        ? styles.rowTablet
        : styles.rowPhone;

  return (
    <View style={[styles.section, { paddingHorizontal: pad }]}>
      <View style={rowStyle}>
        <View style={[styles.searchWrap, layout.isPhone && styles.searchWrapFull]}>
          <PosIcon name="search" size={layout.iconSize * 0.85} color={posColors.textDim} />
          <PosInput
            ref={searchInputRef}
            value={search}
            onChangeText={onSearchChange}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="Search product…  ( / )"
            style={[styles.search, { fontSize: layout.moderateScale(15) }]}
          />
          {onBarcodeScan ? (
            <Pressable
              onPress={onBarcodeScan}
              style={[styles.scanBtn, { minWidth: layout.minTouch, minHeight: layout.minTouch }]}
              accessibilityLabel="Scan barcode"
            >
              <Text style={[styles.scanText, { fontSize: layout.moderateScale(16) }]}>⌗</Text>
            </Pressable>
          ) : null}
        </View>
        {headerAction ? <View style={styles.headerAction}>{headerAction}</View> : null}
      </View>

      {orderToolbar ? (
        <View style={[styles.orderToolbar, layout.isLargeTablet && styles.orderToolbarInline]}>
          {orderToolbar}
        </View>
      ) : null}

      {showSuggestions && suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((name) => (
            <Pressable
              key={name}
              onPress={() => onSuggestionSelect?.(name)}
              style={styles.suggestionRow}
            >
              <PosIcon name="search" size={12} color={posColors.textDim} />
              <Text style={styles.suggestionText}>{name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    paddingTop: posSpacing.md,
    paddingBottom: posSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border,
    zIndex: 10
  },
  rowPhone: {
    flexDirection: "column",
    gap: posSpacing.sm
  },
  rowTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: posSpacing.sm
  },
  rowLargeTablet: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.md
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.sm,
    backgroundColor: posColors.card,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.borderStrong,
    paddingHorizontal: posSpacing.md,
    minHeight: 48,
    flex: 1,
    minWidth: 0
  },
  searchWrapFull: { width: "100%" },
  search: { flex: 1, borderWidth: 0, backgroundColor: "transparent", paddingVertical: 12 },
  scanBtn: {
    borderRadius: posRadius.sm,
    backgroundColor: posColors.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: posColors.border
  },
  scanText: { fontWeight: "800", color: posColors.textSecondary },
  headerAction: { flexShrink: 0 },
  orderToolbar: { paddingTop: posSpacing.sm, alignItems: "flex-end", width: "100%" },
  orderToolbarInline: { paddingTop: 0, flex: 1, minWidth: "30%" },
  suggestions: {
    marginTop: posSpacing.xs,
    backgroundColor: posColors.card,
    borderRadius: posRadius.md,
    borderWidth: 1,
    borderColor: posColors.border,
    overflow: "hidden"
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: posSpacing.sm,
    paddingHorizontal: posSpacing.md,
    paddingVertical: posSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border
  },
  suggestionText: { fontSize: 13, fontWeight: "600", color: posColors.text }
});
