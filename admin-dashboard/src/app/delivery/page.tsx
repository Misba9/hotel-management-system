import { AdminAuthGuard } from "@/components/admin/admin-auth-guard";
import { DeliveryPageFeature } from "@/features/delivery/delivery-page";

export default function DeliveryPage() {
  return (
    <AdminAuthGuard allowedRoles={["delivery"]}>
      <DeliveryPageFeature />
    </AdminAuthGuard>
  );
}
