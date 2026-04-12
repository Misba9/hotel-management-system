import { AdminAuthGuard } from "@/components/admin/admin-auth-guard";
import { StaffDetailFeature } from "@/features/staff/staff-detail-page";

export default function AdminStaffDetailPage() {
  return (
    <AdminAuthGuard allowedRoles={["admin"]}>
      <StaffDetailFeature />
    </AdminAuthGuard>
  );
}
