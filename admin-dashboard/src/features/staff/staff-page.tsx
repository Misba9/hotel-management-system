"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  Users,
  X
} from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase";
import { adminApiFetch } from "@/shared/lib/admin-api";
import {
  STAFF_DIRECTORY_PLACEHOLDER_ROLE,
  STAFF_DIRECTORY_ROLE_DESCRIPTIONS,
  STAFF_MANAGEMENT_ROLE_IDS,
  STAFF_ROLE_DESCRIPTIONS,
  type StaffDirectoryRoleId,
  type StaffManagementRoleId
} from "../../../../shared/constants/staff-management-roles";
import { formatAdminStaffApiError, parseCreatedAt } from "./staff-page-helpers";
import { createStaffUser, toggleActive, updateStaffRole } from "@/lib/staffAdmin";

const PAGE_SIZE = 10;

export type StaffDisplayStatus = "active" | "pending" | "disabled";

export type StaffRow = {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: StaffDirectoryRoleId;
  pendingApproval: boolean;
  isActive: boolean;
  displayStatus: StaffDisplayStatus;
  createdAt: Date | null;
  createdByEmail: string | null;
};

export function parseStaffRole(raw: unknown): StaffDirectoryRoleId {
  const r = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (r === STAFF_DIRECTORY_PLACEHOLDER_ROLE) return STAFF_DIRECTORY_PLACEHOLDER_ROLE;
  if (STAFF_MANAGEMENT_ROLE_IDS.includes(r as StaffManagementRoleId)) {
    return r as StaffManagementRoleId;
  }
  return STAFF_DIRECTORY_PLACEHOLDER_ROLE;
}

export function computeDisplayStatus(row: { isActive: boolean; pendingApproval: boolean; role: StaffDirectoryRoleId }): StaffDisplayStatus {
  const needsSetup = row.pendingApproval === true || row.role === STAFF_DIRECTORY_PLACEHOLDER_ROLE;
  if (needsSetup) return "pending";
  if (!row.isActive) return "disabled";
  return "active";
}

const ROLE_BADGE: Record<StaffDirectoryRoleId, string> = {
  admin: "bg-violet-100 text-violet-800 ring-1 ring-violet-200",
  manager: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
  cashier: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
  kitchen: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200",
  delivery: "bg-orange-100 text-orange-900 ring-1 ring-orange-200",
  waiter: "bg-fuchsia-100 text-fuchsia-900 ring-1 ring-fuchsia-200",
  staff: "bg-amber-50 text-amber-900 ring-1 ring-amber-300"
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function StaffPageFeature() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | StaffDirectoryRoleId>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "pending">("all");
  const [page, setPage] = useState(1);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<StaffRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<StaffRow | null>(null);
  const [resetRow, setResetRow] = useState<StaffRow | null>(null);

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<StaffManagementRoleId>("cashier");
  const [formActive, setFormActive] = useState(true);

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<StaffManagementRoleId>("cashier");
  const [editActive, setEditActive] = useState(true);

  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = onSnapshot(
      collection(getFirebaseDb(), "staff_users"),
      (snap) => {
        const next: StaffRow[] = snap.docs.map((d) => {
          const data = d.data() as {
            uid?: unknown;
            name?: unknown;
            email?: unknown;
            role?: unknown;
            isActive?: unknown;
            pendingApproval?: unknown;
            createdAt?: unknown;
            createdByEmail?: unknown;
          };
          const role = parseStaffRole(data.role);
          const pendingApproval = data.pendingApproval === true;
          const isActive = data.isActive !== false;
          const base = {
            id: d.id,
            uid: String(data.uid ?? d.id),
            name: String(data.name ?? "—"),
            email: String(data.email ?? "—"),
            role,
            pendingApproval,
            isActive,
            createdAt: parseCreatedAt(data.createdAt),
            createdByEmail: typeof data.createdByEmail === "string" ? data.createdByEmail : null
          };
          return {
            ...base,
            displayStatus: computeDisplayStatus(base)
          };
        });
        next.sort((a, b) => {
          const ta = a.createdAt?.getTime() ?? 0;
          const tb = b.createdAt?.getTime() ?? 0;
          return tb - ta;
        });
        setRows(next);
        setLoading(false);
      },
      () => {
        setError("Failed to load staff list.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (statusFilter === "active" && r.displayStatus !== "active") return false;
      if (statusFilter === "inactive" && r.displayStatus !== "disabled") return false;
      if (statusFilter === "pending" && r.displayStatus !== "pending") return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
    });
  }, [rows, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  function openAdd() {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("cashier");
    setFormActive(true);
    setAddOpen(true);
    setError(null);
  }

  function openEdit(row: StaffRow) {
    setEditRow(row);
    setEditName(row.name);
    setEditRole(row.role === STAFF_DIRECTORY_PLACEHOLDER_ROLE ? "cashier" : row.role);
    setEditActive(row.isActive);
    setError(null);
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (formPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createStaffUser({
        name: formName.trim(),
        email: formEmail.trim(),
        password: formPassword,
        role: formRole,
        isActive: formActive
      });
      setAddOpen(false);
      showToast("Staff member created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setCreating(false);
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminApiFetch(`/api/admin/staff-users/${encodeURIComponent(editRow.uid)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          role: editRole,
          isActive: editActive
        })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Update failed.");
      }
      setEditRow(null);
      showToast("Staff updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteRow) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await adminApiFetch(`/api/admin/staff-users/${encodeURIComponent(deleteRow.uid)}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Delete failed.");
      }
      setDeleteRow(null);
      showToast("Staff member removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  async function confirmReset() {
    if (!resetRow || newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setResetting(true);
    setError(null);
    try {
      const res = await adminApiFetch(
        `/api/admin/staff-users/${encodeURIComponent(resetRow.uid)}/reset-password`,
        {
          method: "POST",
          body: JSON.stringify({ newPassword })
        }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Reset failed.");
      }
      setResetRow(null);
      setNewPassword("");
      showToast("Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setResetting(false);
    }
  }

  function exportCsv() {
    const header = ["Name", "Email", "Role", "Status", "Active flag", "Created", "Created by"];
    const lines = filtered.map((r) =>
      [
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.email.replace(/"/g, '""')}"`,
        r.role,
        r.displayStatus,
        r.isActive ? "true" : "false",
        r.createdAt ? r.createdAt.toISOString() : "",
        r.createdByEmail ? `"${r.createdByEmail.replace(/"/g, '""')}"` : ""
      ].join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV downloaded.");
  }

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.displayStatus === "active").length;
    const pending = rows.filter((r) => r.displayStatus === "pending").length;
    const disabled = rows.filter((r) => r.displayStatus === "disabled").length;
    return { total: rows.length, active, pending, disabled };
  }, [rows]);

  async function patchStaffUser(member: StaffRow, body: { role?: StaffManagementRoleId; isActive?: boolean }) {
    setUpdatingUid(member.uid);
    setError(null);
    try {
      if (body.role !== undefined) {
        await updateStaffRole(member.uid, body.role);
      } else if (body.isActive !== undefined) {
        await toggleActive(member.uid, body.isActive);
      }
      showToast("Updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setUpdatingUid(null);
    }
  }

  async function approveStaffUser(member: StaffRow) {
    if (member.role === STAFF_DIRECTORY_PLACEHOLDER_ROLE) {
      setError("Assign a role before approving.");
      return;
    }
    await patchStaffUser(member, { isActive: true });
  }

  async function changeRowRole(member: StaffRow, role: StaffManagementRoleId) {
    await patchStaffUser(member, { role });
  }

  async function toggleRowActive(member: StaffRow, next: boolean) {
    await patchStaffUser(member, { isActive: next });
  }

  return (
    <div className="space-y-6 pb-10">
      {toast ? (
        <div className="fixed bottom-6 right-6 z-[60] rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-orange-500">
            <Shield className="h-8 w-8" aria-hidden />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Staff management</h1>
          </div>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Approve self-signups, assign roles, activate or disable accounts. Changes sync in real time from Firestore.
            Assign <span className="font-semibold text-slate-800">waiter</span> and click <span className="font-semibold text-slate-800">Approve</span> (or use{" "}
            <span className="font-semibold text-slate-800">Add staff</span> with role waiter) — the staff mobile app opens the{" "}
            <span className="font-semibold text-slate-800">Waiter Dashboard</span> after sign-in.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            {(Object.keys(STAFF_DIRECTORY_ROLE_DESCRIPTIONS) as StaffDirectoryRoleId[]).map((rid) => (
              <span key={rid} className="rounded-lg bg-white/80 px-2 py-1 ring-1 ring-slate-200">
                <span className="font-semibold text-slate-700">{rid}</span>
                <span className="text-slate-500"> — {STAFF_DIRECTORY_ROLE_DESCRIPTIONS[rid]}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            <div className="rounded-2xl bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-slate-200/80">
              <Users className="mb-1 inline h-4 w-4 text-orange-500" aria-hidden />
              <div className="font-semibold text-slate-900">{stats.active} active</div>
              <div className="text-xs text-slate-500">of {stats.total} total</div>
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-2 text-sm shadow-sm ring-1 ring-amber-200/80">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-800">Pending</div>
              <div className="font-semibold text-amber-950">{stats.pending}</div>
              <div className="text-xs text-amber-800/80">awaiting approval</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm shadow-sm ring-1 ring-slate-200/80">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-600">Disabled</div>
              <div className="font-semibold text-slate-900">{stats.disabled}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-orange-600 hover:to-orange-700"
          >
            <Plus className="h-4 w-4" />
            Add staff
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
            >
              <option value="all">All roles</option>
              <option value={STAFF_DIRECTORY_PLACEHOLDER_ROLE}>staff (pending setup)</option>
              {STAFF_MANAGEMENT_ROLE_IDS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="pending">Pending approval</option>
              <option value="inactive">Disabled only</option>
            </select>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            Loading staff…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Users className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 font-medium">No staff match your filters</p>
            <p className="text-sm">Try adjusting search or add a new team member.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-gradient-to-r from-slate-50 to-orange-50/30">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageSlice.map((member) => (
                  <tr
                    key={member.id}
                    className={`transition hover:bg-orange-50/40 ${updatingUid === member.uid ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/staff/${member.uid}`}
                        className="font-semibold text-slate-900 hover:text-orange-600 hover:underline"
                      >
                        {member.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{member.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <span
                          className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${ROLE_BADGE[member.role]}`}
                        >
                          {member.role}
                        </span>
                        <select
                          value={member.role === STAFF_DIRECTORY_PLACEHOLDER_ROLE ? "" : member.role}
                          disabled={updatingUid === member.uid}
                          onChange={(e) => {
                            const v = e.target.value as StaffManagementRoleId;
                            if (!v) return;
                            void changeRowRole(member, v);
                          }}
                          className="max-w-[11rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-orange-400"
                        >
                          {member.role === STAFF_DIRECTORY_PLACEHOLDER_ROLE ? (
                            <option value="" disabled>
                              Assign role…
                            </option>
                          ) : null}
                          {STAFF_MANAGEMENT_ROLE_IDS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {member.displayStatus === "active" ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                          Active
                        </span>
                      ) : member.displayStatus === "pending" ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                          Pending
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-red-200">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(member.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-2">
                        {member.displayStatus === "pending" ? (
                          <button
                            type="button"
                            title={
                              member.role === STAFF_DIRECTORY_PLACEHOLDER_ROLE
                                ? "Choose a role above before approving"
                                : "Activate account"
                            }
                            disabled={updatingUid === member.uid || member.role === STAFF_DIRECTORY_PLACEHOLDER_ROLE}
                            onClick={() => void approveStaffUser(member)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        ) : (
                          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                            <span>Active</span>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-orange-500"
                              checked={member.isActive}
                              disabled={updatingUid === member.uid}
                              onChange={(e) => void toggleRowActive(member, e.target.checked)}
                            />
                          </label>
                        )}
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(member)}
                            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-orange-600"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResetRow(member);
                              setNewPassword("");
                              setError(null);
                            }}
                            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-orange-600"
                            title="Reset password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteRow(member);
                              setError(null);
                            }}
                            className="rounded-lg p-2 text-slate-600 hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row">
            <p className="text-xs text-slate-500">
              Showing {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pageSafe <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-slate-600">
                Page {pageSafe} / {totalPages}
              </span>
              <button
                type="button"
                disabled={pageSafe >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Add modal */}
      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setAddOpen(false)} aria-label="Close" />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add staff member</h2>
                <p className="text-sm text-slate-500">Creates Firebase Auth user + Firestore profile.</p>
              </div>
              <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void submitAdd(e)} className="mt-6 space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Name</span>
                <input
                  required
                  minLength={2}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Email</span>
                <input
                  required
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Password (min 6 characters)</span>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Role</span>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as StaffManagementRoleId)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20"
                >
                  {STAFF_MANAGEMENT_ROLE_IDS.map((r) => (
                    <option key={r} value={r}>
                      {r} — {STAFF_ROLE_DESCRIPTIONS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-orange-500"
                />
                <span className="font-medium text-slate-700">Active (can sign in)</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create staff
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit modal */}
      {editRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setEditRow(null)} aria-label="Close" />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit staff</h2>
                <p className="text-sm text-slate-500">{editRow.email}</p>
              </div>
              <button type="button" onClick={() => setEditRow(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => void submitEdit(e)} className="mt-6 space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Name</span>
                <input
                  required
                  minLength={2}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Role</span>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as StaffManagementRoleId)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20"
                >
                  {STAFF_MANAGEMENT_ROLE_IDS.map((r) => (
                    <option key={r} value={r}>
                      {r} — {STAFF_ROLE_DESCRIPTIONS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-orange-500"
                />
                <span className="font-medium text-slate-700">Active</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditRow(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Delete confirm */}
      {deleteRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDeleteRow(null)} aria-label="Close" />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Delete staff member?</h2>
            <p className="mt-2 text-sm text-slate-600">
              This removes <strong>{deleteRow.name}</strong> from Firestore and Firebase Authentication. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteRow(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Reset password */}
      {resetRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setResetRow(null)} aria-label="Close" />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Reset password</h2>
            <p className="mt-1 text-sm text-slate-500">Set a new password for {resetRow.name}</p>
            <label className="mt-4 block text-sm">
              <span className="font-medium text-slate-700">New password (min 6)</span>
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetRow(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmReset()}
                disabled={resetting || newPassword.length < 6}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Update password
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
