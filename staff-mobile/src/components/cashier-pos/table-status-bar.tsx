import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { FloorTable } from "../../hooks/use-tables";
import type { TableFilter } from "./pos-types";
import { PosChip } from "./pos-ui";
import { posColors, posRadius, posSpacing, posType } from "./pos-theme";

type Props = {
  tables: FloorTable[];
  selectedTableId: string | null;
  tableFilter: TableFilter;
  onTableFilter: (f: TableFilter) => void;
  onSelectTable: (table: FloorTable | null) => void;
  loading?: boolean;
};

const FILTERS: { id: TableFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "free", label: "Free" },
  { id: "busy", label: "Busy" },
  { id: "billing", label: "Billing" },
  { id: "reserved", label: "Reserved" },
  { id: "parcel", label: "Parcel" }
];

function tableEmoji(status: "free" | "occupied", selected: boolean, billing: boolean, reserved: boolean) {
  if (selected) return "🔵";
  if (billing) return "🟡";
  if (reserved) return "⚫";
  return status === "occupied" ? "🔴" : "🟢";
}

export function TableStatusBar({
  tables,
  selectedTableId,
  tableFilter,
  onTableFilter,
  onSelectTable,
  loading
}: Props) {
  const sorted = useMemo(() => [...tables].sort((a, b) => a.number - b.number), [tables]);

  const visible = useMemo(() => {
    if (tableFilter === "free") return sorted.filter((t) => t.status === "free");
    if (tableFilter === "busy") return sorted.filter((t) => t.status === "occupied");
    if (tableFilter === "billing") return sorted.filter((t) => t.status === "occupied" && t.currentOrderId);
    if (tableFilter === "reserved") return sorted.filter((t) => t.status === "free" && (t.number % 5 === 0));
    if (tableFilter === "parcel") return [];
    return sorted;
  }, [sorted, tableFilter]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={posType.label}>Floor · Tables</Text>
        {loading ? <Text style={styles.loading}>Syncing…</Text> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <PosChip key={f.id} label={f.label} active={tableFilter === f.id} onPress={() => onTableFilter(f.id)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tables}>
        {tableFilter !== "parcel" ? (
          <Pressable
            onPress={() => onSelectTable(null)}
            style={[styles.tablePill, !selectedTableId && styles.tablePillOn]}
          >
            <Text style={styles.tableEmoji}>⚪</Text>
            <Text style={[styles.tableName, !selectedTableId && styles.tableNameOn]}>None</Text>
          </Pressable>
        ) : null}
        {tableFilter === "parcel" ? (
          <View style={styles.parcelHint}>
            <Text style={styles.parcelText}>Parcel orders — no table assignment</Text>
          </View>
        ) : (
          visible.map((table) => {
            const occupied = table.status === "occupied";
            const selected = selectedTableId === table.id;
            const billing = occupied && !!table.currentOrderId;
            const reserved = !occupied && table.number % 5 === 0;
            return (
              <Pressable
                key={table.id}
                onPress={() => onSelectTable(selected ? null : table)}
                style={[
                  styles.tablePill,
                  selected && styles.tablePillOn,
                  occupied && !selected && styles.tablePillBusy
                ]}
              >
                <Text style={styles.tableEmoji}>{tableEmoji(table.status, selected, billing, reserved)}</Text>
                <Text style={[styles.tableName, selected && styles.tableNameOn]}>
                  {table.displayName ?? `T${table.number}`}
                </Text>
                <Text style={[styles.tableStatus, selected && { color: "#ffffffaa" }]}>
                  {occupied ? "Busy" : "Free"}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: posColors.secondary,
    borderBottomWidth: 1,
    borderBottomColor: posColors.border,
    paddingBottom: posSpacing.sm
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: posSpacing.lg,
    paddingTop: posSpacing.sm
  },
  loading: { fontSize: 11, color: posColors.textDim },
  filters: { paddingHorizontal: posSpacing.lg, paddingVertical: posSpacing.sm, gap: posSpacing.sm },
  tables: { paddingHorizontal: posSpacing.lg, gap: posSpacing.sm, alignItems: "center" },
  tablePill: {
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: posRadius.md,
    backgroundColor: posColors.card,
    borderWidth: 1,
    borderColor: posColors.border,
    alignItems: "center"
  },
  tablePillOn: { backgroundColor: posColors.primary, borderColor: posColors.primary },
  tablePillBusy: { borderColor: "rgba(239,68,68,0.35)" },
  tableEmoji: { fontSize: 14, marginBottom: 2 },
  tableName: { fontSize: 13, fontWeight: "900", color: posColors.text },
  tableNameOn: { color: "#fff" },
  tableStatus: { fontSize: 9, fontWeight: "700", color: posColors.textDim, marginTop: 2, textTransform: "uppercase" },
  parcelHint: {
    paddingHorizontal: posSpacing.lg,
    paddingVertical: posSpacing.md,
    borderRadius: posRadius.md,
    backgroundColor: posColors.warningMuted,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)"
  },
  parcelText: { fontSize: 12, fontWeight: "700", color: posColors.warning }
});
