"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { RequestState } from "@/components/admin/request-state";

export function StaffPageFeature() {
  const [staff, setStaff] = useState<Array<{ id: string; name: string; role: string; performanceScore: number; active?: boolean }>>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("kitchen_staff");
  const [score, setScore] = useState("80");
  const [roleFilter, setRoleFilter] = useState("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStaff = useCallback(async (nextRoleFilter: string, append = false, cursorOverride?: string | null) => {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({ limit: "20", role: nextRoleFilter });
    if (append && cursorOverride) query.set("cursor", cursorOverride);
    try {
      const res = await adminApiFetch(`/api/staff?${query.toString()}`);
      if (!res.ok) {
        setError("Failed to load staff.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        items: Array<{ id: string; name: string; role: string; performanceScore: number; active?: boolean }>;
        nextCursor?: string | null;
        hasMore?: boolean;
      };
      setStaff((prev) => (append ? [...prev, ...(data.items ?? [])] : data.items ?? []));
      setCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.hasMore));
    } catch {
      setError("Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCursor(null);
    void loadStaff(roleFilter, false);
  }, [loadStaff, roleFilter]);

  async function addStaff() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role,
          performanceScore: Number(score)
        })
      });
      if (!res.ok) {
        setError("Failed to add staff member.");
        setSaving(false);
        return;
      }
      setName("");
      setRole("kitchen_staff");
      setScore("80");
      setCursor(null);
      await loadStaff(roleFilter, false);
    } catch {
      setError("Failed to add staff member.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStaff(memberId: string, payload: { role?: string; active?: boolean; performanceScore?: number }) {
    setError(null);
    try {
      const res = await adminApiFetch(`/api/staff/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setError("Failed to update staff member.");
        return;
      }
      setCursor(null);
      await loadStaff(roleFilter, false);
    } catch {
      setError("Failed to update staff member.");
    }
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
            {saving ? "Adding..." : "Add Staff"}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">Filter by role</label>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="all">All</option>
          <option value="kitchen_staff">Kitchen Staff</option>
          <option value="waiter">Waiter</option>
          <option value="cashier">Cashier</option>
          <option value="delivery_boy">Delivery Partner</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <RequestState error={error} loading={loading} empty={staff.length === 0} loadingMessage="Loading staff..." emptyMessage="No staff records found." />
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
                value={member.role}
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
              <button
                onClick={() => {
                  void updateStaff(member.id, { performanceScore: Math.min(100, member.performanceScore + 5) });
                }}
                className="rounded border px-3 py-1 text-sm"
              >
                +5 Score
              </button>
            </div>
          </div>
        </div>
      ))}
      {hasMore ? (
        <button
          onClick={() => {
            void loadStaff(roleFilter, true, cursor);
          }}
          className="rounded border px-3 py-2 text-sm"
        >
          Load more
        </button>
      ) : null}
    </section>
  );
}
