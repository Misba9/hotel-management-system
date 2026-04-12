import { AdminAuthGuard } from "@/components/admin/admin-auth-guard";
import { OrdersPageFeature } from "@/features/orders/orders-page";

export default function KitchenPage() {
  return (
    <AdminAuthGuard allowedRoles={["kitchen"]}>
      <OrdersPageFeature />
    </AdminAuthGuard>
  );
}
