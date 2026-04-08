"use client";

import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { adminApiFetch } from "@/shared/lib/admin-api";

export function CustomersPageFeature() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<
    Array<{ id: string; name: string; phone: string; email: string; createdAt: string | null }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminApiFetch("/api/customers");
        const json = (await res.json()) as {
          items?: Array<{ id: string; name: string; phone: string; email: string; createdAt: string | null }>;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Failed to fetch customers.");
        if (!cancelled) setItems(Array.isArray(json.items) ? json.items : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to fetch customers.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-md dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <Users className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Customers</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading customers...
          </div>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </p>
        ) : null}

        {!loading && !error ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-2 py-2 font-semibold">Name</th>
                  <th className="px-2 py-2 font-semibold">Phone</th>
                  <th className="px-2 py-2 font-semibold">Email</th>
                  <th className="px-2 py-2 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-2 text-slate-900 dark:text-slate-100">{row.name || "—"}</td>
                    <td className="px-2 py-2">{row.phone || "—"}</td>
                    <td className="px-2 py-2">{row.email || "—"}</td>
                    <td className="px-2 py-2">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
