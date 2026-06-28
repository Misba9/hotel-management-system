import type { MenuProduct } from "@/services/products";
import type { StaffOrderRow } from "@/services/orders";
import type { FloorTable } from "@/services/tables";
import type { StaffAppRole } from "@shared/utils/staff-access-control";

export type ManagerNavKey =
  | "dashboard"
  | "orders"
  | "tables"
  | "kitchen"
  | "billing"
  | "customers"
  | "inventory"
  | "staff"
  | "reports"
  | "notifications"
  | "settings";

export type ManagerNavItem = {
  key: ManagerNavKey;
  label: string;
  icon: string;
  description: string;
};

export type StaffDirectoryRow = {
  uid: string;
  name: string;
  email: string;
  role: StaffAppRole | null;
  isActive: boolean;
  createdAt: Date | null;
  shift?: string | null;
  clockInAt?: Date | null;
  clockOutAt?: Date | null;
  lastSeenAt?: Date | null;
};

export type ManagerModuleData = {
  orders: StaffOrderRow[];
  tables: FloorTable[];
  products: MenuProduct[];
  staff: StaffDirectoryRow[];
  loading: boolean;
  errors: string[];
  lastUpdated: Date | null;
};
