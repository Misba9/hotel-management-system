"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api";

export default function StaffPage() {
  const [staff, setStaff] = useState<Array<{ id: string; name: string; role: string; performanceScore: number; active?: boolean }>>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("kitchen_staff");
  const [score, setScore] = useState("80");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadStaff = useCallback(async (append = false, cursorOverride?: string | null) => {
    setLoading(true);
    const query = new URLSearchParams({ limit: "20" });
    if (append && cursorOverride) query.set("cursor", cursorOverride);
    const res = await adminApiFetch(`/api/staff?${query.toString()}`);
    const data = (await res.json()) as {
      items: Array<{ id: string; name: string; role: string; performanceScore: number; active?: boolean }>;
      nextCursor?: string | null;
      hasMore?: boolean;
    };
    setStaff((prev) => (append ? [...prev, ...(data.items ?? [])] : data.items ?? []));
    setCursor(data.nextCursor ?? null);
    setHasMore(Boolean(data.hasMore));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  async function addStaff() {
    if (!name.trim()) return;
    await adminApiFetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        role,
        performanceScore: Number(score)
      })
    });
    setName("");
    setRole("kitchen_staff");
    setScore("80");
    setCursor(null);
    await loadStaff(false);
  }

  async function updateStaff(memberId: string, payload: { role?: string; active?: boolean }) {
    await adminApiFetch(`/api/staff/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setCursor(null);
    await loadStaff(false);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Staff Management</h2>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Staff name"
            className="rounded border px-3 py-2 text-sm"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded border px-3 py-2 text-sm">
            <option value="kitchen_staff">Kitchen Staff</option>
            <option value="waiter">Waiter</option>
            <option value="cashier">Cashier</option>
            <option value="delivery_boy">Delivery Partner</option>
            <option value="manager">Manager</option>
          </select>
          <input
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-20 rounded border px-3 py-2 text-sm"
            placeholder="Score"
          />
          <button onClick={addStaff} className="rounded bg-orange-500 px-3 py-2 text-sm text-white">
            Add Staff
          </button>
        </div>
      </div>
      {loading ? <p className="text-sm text-slate-500">Loading staff...</p> : null}
      {staff.map((member) => (
        <div key={member.id} className="rounded-xl bg-white p-4 shadow">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">{member.name}</p>
              <p className="text-sm text-gray-500">{member.role}</p>
              <p className="text-sm">Performance: {member.performanceScore}%</p>
              <p className="text-sm">{member.active === false ? "Inactive" : "Active"}</p>
            </div>
            <div className="flex gap-2">
              <select
                defaultValue={member.role}
                onChange={(e) => {
                  void updateStaff(member.id, { role: e.target.value });
                }}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="kitchen_staff">Kitchen Staff</option>
                <option value="waiter">Waiter</option>
                <option value="cashier">Cashier</option>
                <option value="delivery_boy">Delivery Partner</option>
                <option value="manager">Manager</option>
              </select>
              <button
                onClick={() => {
                  void updateStaff(member.id, { active: member.active === false });
                }}
                className="rounded border px-3 py-1 text-sm"
              >
                {member.active === false ? "Activate" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      ))}
      {hasMore ? (
        <button
          onClick={() => {
            void loadStaff(true, cursor);
          }}
          className="rounded border px-3 py-2 text-sm"
        >
          Load more
        </button>
      ) : null}
    </section>
  );
}
