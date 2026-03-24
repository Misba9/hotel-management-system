"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { RequestState } from "@/components/admin/request-state";

type Partner = { id: string; name: string; activeOrders?: number };
type Assignment = { id: string; orderId: string; deliveryBoyId: string; status: string; updatedAt?: string };

export function DeliveryPageFeature() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderId, setOrderId] = useState("");
  const [deliveryPartnerId, setDeliveryPartnerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/delivery");
      if (!res.ok) {
        setError("Failed to load delivery data.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { partners: Partner[]; assignments: Assignment[] };
      setPartners(data.partners ?? []);
      setAssignments(data.assignments ?? []);
      if ((data.partners ?? []).length > 0) {
        setDeliveryPartnerId((prev) => prev || data.partners[0].id);
      }
    } catch {
      setError("Failed to load delivery data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function addPartner() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "add_partner",
          name: name.trim(),
          phone: phone.trim()
        })
      });
      if (!res.ok) {
        setError("Failed to add delivery partner.");
        setSaving(false);
        return;
      }
      setName("");
      setPhone("");
      await loadData();
    } catch {
      setError("Failed to add delivery partner.");
    } finally {
      setSaving(false);
    }
  }

  async function assignOrder() {
    if (!orderId.trim() || !deliveryPartnerId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "assign_order",
          orderId: orderId.trim(),
          deliveryPartnerId
        })
      });
      if (!res.ok) {
        setError("Failed to assign order.");
        setSaving(false);
        return;
      }
      setOrderId("");
      await loadData();
    } catch {
      setError("Failed to assign order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Delivery Management</h2>
      <RequestState
        error={error}
        loading={loading}
        empty={assignments.length === 0}
        loadingMessage="Loading delivery data..."
        emptyMessage="No delivery assignments found."
      />
      <div className="rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-3 font-semibold">Add Delivery Partner</h3>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Partner name" className="rounded border px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="rounded border px-3 py-2 text-sm" />
          <button onClick={addPartner} disabled={saving} className="rounded bg-orange-500 px-3 py-2 text-sm text-white disabled:opacity-60">
            Add
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-3 font-semibold">Assign Order</h3>
        <div className="flex gap-2">
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Order ID" className="rounded border px-3 py-2 text-sm" />
          <select value={deliveryPartnerId} onChange={(e) => setDeliveryPartnerId(e.target.value)} className="rounded border px-3 py-2 text-sm">
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
          <button onClick={assignOrder} disabled={saving} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60">
            Assign
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-3 font-semibold">Recent Assignments</h3>
        <div className="space-y-2">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="rounded-lg border px-3 py-2">
              <p className="font-medium">
                {assignment.orderId} → {assignment.deliveryBoyId}
              </p>
              <p className="text-sm text-slate-600">
                {assignment.status} • {assignment.updatedAt ? new Date(assignment.updatedAt).toLocaleString() : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
