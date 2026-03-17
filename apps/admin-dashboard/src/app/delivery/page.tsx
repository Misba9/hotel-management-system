"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api";

type Partner = { id: string; name: string; activeOrders?: number };
type Assignment = { id: string; orderId: string; deliveryBoyId: string; status: string; updatedAt?: string };

export default function DeliveryPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderId, setOrderId] = useState("");
  const [deliveryPartnerId, setDeliveryPartnerId] = useState("");

  const loadData = useCallback(async () => {
    const res = await adminApiFetch("/api/delivery");
    const data = (await res.json()) as { partners: Partner[]; assignments: Assignment[] };
    setPartners(data.partners ?? []);
    setAssignments(data.assignments ?? []);
    if ((data.partners ?? []).length > 0) {
      setDeliveryPartnerId((prev) => prev || data.partners[0].id);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function addPartner() {
    if (!name.trim()) return;
    await adminApiFetch("/api/delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "add_partner",
        name: name.trim(),
        phone: phone.trim()
      })
    });
    setName("");
    setPhone("");
    await loadData();
  }

  async function assignOrder() {
    if (!orderId.trim() || !deliveryPartnerId) return;
    await adminApiFetch("/api/delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "assign_order",
        orderId: orderId.trim(),
        deliveryPartnerId
      })
    });
    setOrderId("");
    await loadData();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Delivery Management</h2>
      <div className="rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-3 font-semibold">Add Delivery Partner</h3>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Partner name" className="rounded border px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="rounded border px-3 py-2 text-sm" />
          <button onClick={addPartner} className="rounded bg-orange-500 px-3 py-2 text-sm text-white">
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
          <button onClick={assignOrder} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
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
