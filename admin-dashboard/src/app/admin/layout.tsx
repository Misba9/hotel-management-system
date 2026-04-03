import { ReactNode } from "react";
import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";

export default function AdminRouteLayout({ children }: { children: ReactNode }) {
  return <AdminDashboardShell>{children}</AdminDashboardShell>;
}
