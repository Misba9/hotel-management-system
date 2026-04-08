import { ReactNode } from "react";
import { AdminAuthGuard } from "@/components/admin/admin-auth-guard";
import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";

export default function AdminRouteLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthGuard>
      <AdminDashboardShell>{children}</AdminDashboardShell>
    </AdminAuthGuard>
  );
}
