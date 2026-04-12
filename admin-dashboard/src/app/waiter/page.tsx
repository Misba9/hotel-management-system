import { AdminAuthGuard } from "@/components/admin/admin-auth-guard";

export default function WaiterPage() {
  return (
    <AdminAuthGuard allowedRoles={["waiter"]}>
      <section className="mx-auto max-w-4xl space-y-3 p-6">
        <h1 className="text-2xl font-bold text-slate-900">Waiter</h1>
        <p className="text-sm text-slate-600">Table ordering screen is available for waiter role users.</p>
      </section>
    </AdminAuthGuard>
  );
}
