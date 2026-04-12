import { AdminAuthGuard } from "@/components/admin/admin-auth-guard";
import { StaffPageFeature } from "@/features/staff/staff-page";

export default function AdminStaffPage() {
  return (
    <AdminAuthGuard allowedRoles={["admin"]}>
      <StaffPageFeature />
    </AdminAuthGuard>
  );
}
