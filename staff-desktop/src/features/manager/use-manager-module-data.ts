import { useEffect, useMemo, useState } from "react";
import { collection } from "firebase/firestore";
import { subscribeFirestoreQuery } from "@/lib/firestore-listener";
import { staffDb } from "@/lib/staff-db";
import { subscribeRecentOrders, type StaffOrderRow } from "@/services/orders";
import { subscribeMenuProducts, type MenuProduct } from "@/services/products";
import { subscribeAllTables, type FloorTable } from "@/services/tables";
import { normalizeStaffAppRole, type StaffAppRole } from "@shared/utils/staff-access-control";
import type { ManagerModuleData, StaffDirectoryRow } from "./types";

type LoadState = {
  orders: boolean;
  tables: boolean;
  products: boolean;
  staff: boolean;
};

function toDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      return value.toDate() as Date;
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function mapStaffRow(id: string, data: Record<string, unknown>): StaffDirectoryRow {
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const role = normalizeStaffAppRole(data.role);
  const name =
    (typeof data.name === "string" && data.name.trim()) ||
    (typeof data.displayName === "string" && data.displayName.trim()) ||
    (email.includes("@") ? email.split("@")[0] : id.slice(0, 8));
  const isActive = data.isActive !== false;
  return {
    uid: id,
    name,
    email,
    role: role as StaffAppRole | null,
    isActive,
    createdAt: toDate(data.createdAt),
    shift: typeof data.shift === "string" ? data.shift : null,
    clockInAt: toDate(data.clockInAt),
    clockOutAt: toDate(data.clockOutAt),
    lastSeenAt: toDate(data.lastSeenAt ?? data.lastActiveAt ?? data.updatedAt)
  };
}

export function useManagerModuleData(): ManagerModuleData {
  const [orders, setOrders] = useState<StaffOrderRow[]>([]);
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [staff, setStaff] = useState<StaffDirectoryRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({
    orders: true,
    tables: true,
    products: true,
    staff: true
  });

  useEffect(() => {
    const markLoaded = (key: keyof LoadState) => {
      setLoadState((prev) => ({ ...prev, [key]: false }));
    };
    const captureError = (scope: string, err: Error) => {
      setErrors((prev) => {
        const message = `${scope}: ${err.message}`;
        return prev.includes(message) ? prev : [...prev, message];
      });
      markLoaded(scope as keyof LoadState);
    };

    const unsubOrders = subscribeRecentOrders(
      (rows) => {
        setOrders(rows);
        setLastUpdated(new Date());
        markLoaded("orders");
      },
      (err) => captureError("orders", err)
    );

    const unsubTables = subscribeAllTables(
      (rows) => {
        setTables(rows);
        setLastUpdated(new Date());
        markLoaded("tables");
      },
      (err) => captureError("tables", err)
    );

    const unsubProducts = subscribeMenuProducts(
      (rows) => {
        setProducts(rows);
        setLastUpdated(new Date());
        markLoaded("products");
      },
      (err) => captureError("products", err)
    );

    const unsubStaff = subscribeFirestoreQuery(
      "managerModule.staff_users",
      collection(staffDb, "staff_users"),
      (snap) => {
        const rows = snap.docs
          .map((d) => mapStaffRow(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => a.name.localeCompare(b.name));
        setStaff(rows);
        setLastUpdated(new Date());
        markLoaded("staff");
      },
      (err) => captureError("staff", err)
    );

    return () => {
      unsubOrders();
      unsubTables();
      unsubProducts();
      unsubStaff();
    };
  }, []);

  const loading = useMemo(
    () => loadState.orders || loadState.tables || loadState.products || loadState.staff,
    [loadState]
  );

  return { orders, tables, products, staff, loading, errors, lastUpdated };
}
