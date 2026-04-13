import { AdminAuthGuard } from "@/components/admin/admin-auth-guard";

export default function CounterPage() {
  return (
    <AdminAuthGuard allowedRoles={["cashier"]}>
      <section className="mx-auto max-w-4xl space-y-3 p-6">
        <h1 className="text-2xl font-bold text-slate-900">Counter</h1>
        <p className="text-sm text-slate-600">Counter billing screen is available for counter role users.</p>
      </section>
    </AdminAuthGuard>
  );
}
