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
  DEFAULT_ROLE_APP_ACCESS,
  defaultAppsForRole,
  formatAppAccessLabel,
  parseAllowedApps,
  type StaffAppPlatform
} from "../../../../shared/constants/staff-app-access";
import {
  STAFF_DIRECTORY_PLACEHOLDER_ROLE,
  STAFF_MANAGEMENT_ROLE_IDS,
  STAFF_ROLE_DESCRIPTIONS,
  type StaffDirectoryRoleId,
  type StaffManagementRoleId
} from "../../../../shared/constants/staff-management-roles";
import { parseCreatedAt } from "./staff-page-helpers";
import { createStaffUser, toggleActive } from "@/lib/staffAdmin";
import { PageShell } from "@/components/admin/page-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const selectClass =
  "rounded-xl border border-theme-border bg-theme-input-bg px-3 py-2 text-sm text-theme-text-primary outline-none transition focus:border-theme-primary/40 focus:ring-2 focus:ring-theme-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

const modalOverlayClass = "absolute inset-0 bg-theme-overlay/80 backdrop-blur-sm";
const modalPanelClass =
  "relative z-10 w-full rounded-2xl border border-theme-border bg-theme-card p-6 shadow-2xl";

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
  allowedApps: StaffAppPlatform[];
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

function appsFromFlags(desktop: boolean, mobile: boolean): StaffAppPlatform[] {
  const apps: StaffAppPlatform[] = [];
  if (desktop) apps.push("desktop");
  if (mobile) apps.push("mobile");
  return apps;
}

function AppAccessBadges({ apps }: { apps: readonly StaffAppPlatform[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {apps.includes("desktop") ? <Badge variant="neutral">Desktop</Badge> : null}
      {apps.includes("mobile") ? <Badge variant="default">Mobile</Badge> : null}
    </div>
  );
}

function LoginAccessFields({
  desktop,
  mobile,
  onDesktop,
  onMobile
}: {
  desktop: boolean;
  mobile: boolean;
  onDesktop: (v: boolean) => void;
  onMobile: (v: boolean) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-theme-border p-3">
      <legend className="px-1 text-sm font-medium text-theme-text-secondary">Login access</legend>
      <div className="mt-2 flex flex-col gap-2 text-sm">
        <label className="flex items-center gap-3 text-theme-text-primary">
          <input
            type="checkbox"
            checked={desktop}
            onChange={(e) => onDesktop(e.target.checked)}
            className="h-4 w-4 rounded border-theme-border text-brand-primary focus:ring-brand-primary/30"
          />
          <span className="font-medium">Desktop app</span>
        </label>
        <label className="flex items-center gap-3 text-theme-text-primary">
          <input
            type="checkbox"
            checked={mobile}
            onChange={(e) => onMobile(e.target.checked)}
            className="h-4 w-4 rounded border-theme-border text-brand-primary focus:ring-brand-primary/30"
          />
          <span className="font-medium">Mobile app</span>
        </label>
      </div>
    </fieldset>
  );
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function normalizeUid(rawUid: unknown, fallbackUid: string): string {
  const primary = typeof rawUid === "string" ? rawUid.trim() : "";
  if (primary) return primary;
  return fallbackUid.trim();
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
  const [formDesktop, setFormDesktop] = useState(true);
  const [formMobile, setFormMobile] = useState(false);

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<StaffManagementRoleId>("cashier");
  const [editActive, setEditActive] = useState(true);
  const [editDesktop, setEditDesktop] = useState(true);
  const [editMobile, setEditMobile] = useState(false);

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
            allowedApps?: unknown;
            createdAt?: unknown;
            createdByEmail?: unknown;
          };
          const role = parseStaffRole(data.role);
          const allowedApps =
            role === STAFF_DIRECTORY_PLACEHOLDER_ROLE
              ? []
              : parseAllowedApps(data.allowedApps, role as StaffManagementRoleId);
          const pendingApproval = data.pendingApproval === true;
          const isActive = data.isActive !== false;
          const base = {
            id: d.id,
            uid: normalizeUid(data.uid, d.id),
            name: String(data.name ?? "—"),
            email: String(data.email ?? "—"),
            role,
            allowedApps,
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

  useEffect(() => {
    const defaults = defaultAppsForRole(formRole);
    setFormDesktop(defaults.includes("desktop"));
    setFormMobile(defaults.includes("mobile"));
  }, [formRole]);

  function openAdd() {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("cashier");
    setFormActive(true);
    const defaults = defaultAppsForRole("cashier");
    setFormDesktop(defaults.includes("desktop"));
    setFormMobile(defaults.includes("mobile"));
    setAddOpen(true);
    setError(null);
  }

  function openEdit(row: StaffRow) {
    setEditRow(row);
    setEditName(row.name);
    const role = row.role === STAFF_DIRECTORY_PLACEHOLDER_ROLE ? "cashier" : row.role;
    setEditRole(role);
    setEditActive(row.isActive);
    setEditDesktop(row.allowedApps.includes("desktop"));
    setEditMobile(row.allowedApps.includes("mobile"));
    setError(null);
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (formPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    const allowedApps = appsFromFlags(formDesktop, formMobile);
    if (allowedApps.length === 0) {
      setError("Select at least one login platform (Desktop or Mobile).");
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
        isActive: formActive,
        allowedApps
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
    const allowedApps = appsFromFlags(editDesktop, editMobile);
    if (allowedApps.length === 0) {
      setError("Select at least one login platform (Desktop or Mobile).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await adminApiFetch(`/api/admin/staff-users/${encodeURIComponent(editRow.uid)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          role: editRole,
          isActive: editActive,
          allowedApps
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
      const res = await adminApiFetch(`/api/admin/staff-users/${encodeURIComponent(resetRow.uid)}`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Reset failed.");
      }
      setResetRow(null);
      setNewPassword("");
      showToast("Password updated.");
    } catch (err) {
      if (err instanceof TypeError) {
        setError("Could not reach the server. Restart the admin app (`npm run dev:admin`) and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Reset failed.");
      }
    } finally {
      setResetting(false);
    }
  }

  function exportCsv() {
    const header = ["Name", "Email", "Role", "Login access", "Status", "Active flag", "Created", "Created by"];
    const lines = filtered.map((r) =>
      [
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.email.replace(/"/g, '""')}"`,
        r.role,
        formatAppAccessLabel(r.allowedApps),
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

  async function patchStaffUser(
    member: StaffRow,
    body: { role?: StaffManagementRoleId; isActive?: boolean; allowedApps?: StaffAppPlatform[] }
  ) {
    setUpdatingUid(member.uid);
    setError(null);
    try {
      if (body.role !== undefined || body.allowedApps !== undefined) {
        const res = await adminApiFetch(`/api/admin/staff-users/${encodeURIComponent(member.uid)}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...(body.role !== undefined ? { role: body.role } : {}),
            ...(body.allowedApps !== undefined ? { allowedApps: body.allowedApps } : {}),
            ...(body.role !== undefined && body.allowedApps === undefined
              ? { allowedApps: defaultAppsForRole(body.role) }
              : {})
          })
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(j?.error ?? "Update failed.");
        }
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
    <>
      {toast ? (
        <div className="fixed bottom-6 right-6 z-[60] rounded-2xl border border-theme-border bg-theme-card px-4 py-3 text-sm font-medium text-theme-text-primary shadow-lg">
          {toast}
        </div>
      ) : null}

      <PageShell
        badge="Team"
        title="Staff management"
        description="Approve self-signups, assign roles, and manage login access. Changes sync in real time from Firestore."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button type="button" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add staff
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            title="Active staff"
            value={stats.active}
            hint={`of ${stats.total} total`}
            icon={Users}
            accent="orange"
            loading={loading}
          />
          <MetricCard
            title="Pending approval"
            value={stats.pending}
            hint="awaiting role or activation"
            icon={UserCheck}
            accent="amber"
            loading={loading}
          />
          <MetricCard title="Disabled" value={stats.disabled} icon={Shield} accent="rose" loading={loading} />
        </div>

        <div className="flex flex-wrap gap-2">
          {STAFF_MANAGEMENT_ROLE_IDS.map((rid) => (
            <span
              key={rid}
              className="rounded-lg border border-theme-border bg-theme-hover/40 px-2.5 py-1 text-xs text-theme-text-secondary"
            >
              <span className="font-semibold capitalize text-theme-text-primary">{rid}</span>
              <span className="text-theme-text-disabled">
                {" "}
                — {STAFF_ROLE_DESCRIPTIONS[rid]} · {formatAppAccessLabel(DEFAULT_ROLE_APP_ACCESS[rid])}
              </span>
            </span>
          ))}
        </div>

        <GlassCard className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-text-disabled" />
              <Input
                type="search"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                className={selectClass}
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
                className={selectClass}
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="pending">Pending approval</option>
                <option value="inactive">Disabled only</option>
              </select>
            </div>
          </div>
        </GlassCard>

        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
        ) : null}

        <GlassCard className="overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-theme-text-secondary">
            <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
            Loading staff…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-theme-text-secondary">
            <Users className="mx-auto h-10 w-10 text-theme-text-disabled" />
            <p className="mt-2 font-medium text-theme-text-primary">No staff match your filters</p>
            <p className="text-sm text-theme-text-disabled">Try adjusting search or add a new team member.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="theme-table min-w-full text-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Login</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageSlice.map((member) => (
                  <tr
                    key={member.id}
                    className={cn("transition-colors", updatingUid === member.uid && "opacity-60")}
                  >
                    <td>
                      <Link
                        href={`/admin/staff/${member.uid}`}
                        className="font-semibold text-theme-text-primary hover:text-brand-primary hover:underline"
                      >
                        {member.name}
                      </Link>
                    </td>
                    <td className="text-theme-text-secondary">{member.email}</td>
                    <td>
                      <select
                        value={member.role === STAFF_DIRECTORY_PLACEHOLDER_ROLE ? "" : member.role}
                        disabled={updatingUid === member.uid}
                        onChange={(e) => {
                          const v = e.target.value as StaffManagementRoleId;
                          if (!v) return;
                          void changeRowRole(member, v);
                        }}
                        className={cn(selectClass, "max-w-[10rem] py-1.5 text-xs capitalize")}
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
                    </td>
                    <td>
                      {member.role === STAFF_DIRECTORY_PLACEHOLDER_ROLE ? (
                        <span className="text-xs text-theme-text-disabled">—</span>
                      ) : (
                        <AppAccessBadges apps={member.allowedApps} />
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        {member.displayStatus === "active" ? (
                          <Badge variant="success">Active</Badge>
                        ) : member.displayStatus === "pending" ? (
                          <Badge variant="warning">Pending</Badge>
                        ) : (
                          <Badge variant="danger">Disabled</Badge>
                        )}
                        {member.displayStatus === "pending" ? (
                          <Button
                            type="button"
                            size="sm"
                            title={
                              member.role === STAFF_DIRECTORY_PLACEHOLDER_ROLE
                                ? "Choose a role before approving"
                                : "Activate account"
                            }
                            disabled={updatingUid === member.uid || member.role === STAFF_DIRECTORY_PLACEHOLDER_ROLE}
                            onClick={() => void approveStaffUser(member)}
                            className="h-7 bg-emerald-600 px-2.5 text-xs hover:bg-emerald-700"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                        ) : (
                          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-theme-text-secondary">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-theme-border text-brand-primary focus:ring-brand-primary/30"
                              checked={member.isActive}
                              disabled={updatingUid === member.uid}
                              onChange={(e) => void toggleRowActive(member, e.target.checked)}
                            />
                            <span>{member.isActive ? "Enabled" : "Disabled"}</span>
                          </label>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-theme-text-secondary">{fmtDate(member.createdAt)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(member)}
                          title="Edit"
                          className="h-8 w-8 text-theme-text-secondary hover:text-brand-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setResetRow(member);
                            setNewPassword("");
                            setError(null);
                          }}
                          title="Reset password"
                          className="h-8 w-8 text-theme-text-secondary hover:text-brand-primary"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeleteRow(member);
                            setError(null);
                          }}
                          title="Delete"
                          className="h-8 w-8 text-theme-text-secondary hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-theme-divider px-4 py-3 sm:flex-row">
            <p className="text-xs text-theme-text-disabled">
              Showing {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                disabled={pageSafe <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-theme-text-secondary">
                Page {pageSafe} / {totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                disabled={pageSafe >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
        </GlassCard>
      </PageShell>

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className={modalOverlayClass} onClick={() => setAddOpen(false)} aria-label="Close" />
          <div className={cn(modalPanelClass, "max-w-lg")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-theme-text-primary">Add staff member</h2>
                <p className="text-sm text-theme-text-secondary">Creates Firebase Auth user + Firestore profile.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setAddOpen(false)} className="h-8 w-8">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <form onSubmit={(e) => void submitAdd(e)} className="mt-6 space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-theme-text-secondary">Name</span>
                <Input required minLength={2} value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-1" />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-theme-text-secondary">Email</span>
                <Input required type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="mt-1" />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-theme-text-secondary">Password (min 6 characters)</span>
                <Input
                  required
                  type="password"
                  minLength={6}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="mt-1"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-theme-text-secondary">Role</span>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as StaffManagementRoleId)}
                  className={cn(selectClass, "mt-1 w-full")}
                >
                  {STAFF_MANAGEMENT_ROLE_IDS.map((r) => (
                    <option key={r} value={r}>
                      {r} — {STAFF_ROLE_DESCRIPTIONS[r]} ({formatAppAccessLabel(DEFAULT_ROLE_APP_ACCESS[r])})
                    </option>
                  ))}
                </select>
              </label>
              <LoginAccessFields desktop={formDesktop} mobile={formMobile} onDesktop={setFormDesktop} onMobile={setFormMobile} />
              <label className="flex items-center gap-3 text-sm text-theme-text-primary">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 rounded border-theme-border text-brand-primary focus:ring-brand-primary/30"
                />
                <span className="font-medium">Active (can sign in)</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create staff
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className={modalOverlayClass} onClick={() => setEditRow(null)} aria-label="Close" />
          <div className={cn(modalPanelClass, "max-w-lg")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-theme-text-primary">Edit staff</h2>
                <p className="text-sm text-theme-text-secondary">{editRow.email}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setEditRow(null)} className="h-8 w-8">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <form onSubmit={(e) => void submitEdit(e)} className="mt-6 space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-theme-text-secondary">Name</span>
                <Input required minLength={2} value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-theme-text-secondary">Role</span>
                <select
                  value={editRole}
                  onChange={(e) => {
                    const next = e.target.value as StaffManagementRoleId;
                    setEditRole(next);
                    const defaults = defaultAppsForRole(next);
                    setEditDesktop(defaults.includes("desktop"));
                    setEditMobile(defaults.includes("mobile"));
                  }}
                  className={cn(selectClass, "mt-1 w-full")}
                >
                  {STAFF_MANAGEMENT_ROLE_IDS.map((r) => (
                    <option key={r} value={r}>
                      {r} — {STAFF_ROLE_DESCRIPTIONS[r]} ({formatAppAccessLabel(DEFAULT_ROLE_APP_ACCESS[r])})
                    </option>
                  ))}
                </select>
              </label>
              <LoginAccessFields desktop={editDesktop} mobile={editMobile} onDesktop={setEditDesktop} onMobile={setEditMobile} />
              <label className="flex items-center gap-3 text-sm text-theme-text-primary">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-theme-border text-brand-primary focus:ring-brand-primary/30"
                />
                <span className="font-medium">Active</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setEditRow(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className={modalOverlayClass} onClick={() => setDeleteRow(null)} aria-label="Close" />
          <div className={cn(modalPanelClass, "max-w-md")}>
            <h2 className="text-lg font-bold text-theme-text-primary">Delete staff member?</h2>
            <p className="mt-2 text-sm text-theme-text-secondary">
              This removes <strong className="text-theme-text-primary">{deleteRow.name}</strong> from Firestore and Firebase
              Authentication. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDeleteRow(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {resetRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className={modalOverlayClass} onClick={() => setResetRow(null)} aria-label="Close" />
          <div className={cn(modalPanelClass, "max-w-md")}>
            <h2 className="text-lg font-bold text-theme-text-primary">Reset password</h2>
            <p className="mt-1 text-sm text-theme-text-secondary">Set a new password for {resetRow.name}</p>
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void confirmReset();
              }}
            >
              <label className="block text-sm">
                <span className="font-medium text-theme-text-secondary">New password (min 6)</span>
                <Input
                  type="password"
                  minLength={6}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1"
                />
              </label>
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setResetRow(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={resetting || newPassword.length < 6}>
                  {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Update password
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
