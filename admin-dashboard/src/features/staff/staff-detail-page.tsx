"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, Loader2, Shield } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase";
import { STAFF_DIRECTORY_ROLE_DESCRIPTIONS, STAFF_ROLE_DESCRIPTIONS, type StaffDirectoryRoleId } from "../../../../shared/constants/staff-management-roles";
import { computeDisplayStatus, parseStaffRole, type StaffRow } from "./staff-page";
import { parseCreatedAt } from "./staff-page-helpers";

const ROLE_BADGE: Record<StaffDirectoryRoleId, string> = {
  admin: "bg-violet-100 text-violet-800 ring-1 ring-violet-200",
  manager: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
  cashier: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
  kitchen: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200",
  delivery: "bg-orange-100 text-orange-900 ring-1 ring-orange-200",
  waiter: "bg-fuchsia-100 text-fuchsia-900 ring-1 ring-fuchsia-200",
  staff: "bg-amber-50 text-amber-900 ring-1 ring-amber-300"
};

export function StaffDetailFeature() {
  const params = useParams();
  const uid = typeof params?.uid === "string" ? params.uid : "";
  const [row, setRow] = useState<StaffRow | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      setMissing(true);
      return;
    }
    setLoading(true);
    const ref = doc(getFirebaseDb(), "staff_users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setRow(null);
          setMissing(true);
          setLoading(false);
          return;
        }
        const data = snap.data() as {
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
          id: snap.id,
          uid: String(data.uid ?? snap.id),
          name: String(data.name ?? "—"),
          email: String(data.email ?? "—"),
          role,
          pendingApproval,
          isActive,
          createdAt: parseCreatedAt(data.createdAt),
          createdByEmail: typeof data.createdByEmail === "string" ? data.createdByEmail : null
        };
        setRow({ ...base, displayStatus: computeDisplayStatus(base) });
        setMissing(false);
        setLoading(false);
      },
      () => {
        setMissing(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        Loading profile…
      </div>
    );
  }

  if (missing || !row) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
        <p className="font-semibold text-slate-900">Staff member not found</p>
        <Link href="/admin/staff" className="mt-4 inline-flex text-sm font-semibold text-orange-600 hover:underline">
          ← Back to staff list
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/staff"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Staff directory
      </Link>

      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-orange-500 to-amber-500 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold">
              {row.name.trim().charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 opacity-90" />
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{row.name}</h1>
              </div>
              <p className="mt-1 text-sm text-white/90">{row.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${ROLE_BADGE[row.role]}`}>{row.role}</span>
            {row.displayStatus === "active" ? (
              <span className="rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-bold text-white">Active</span>
            ) : row.displayStatus === "pending" ? (
              <span className="rounded-full bg-amber-400/95 px-3 py-1 text-xs font-bold text-amber-950">Pending approval</span>
            ) : (
              <span className="rounded-full bg-red-600/90 px-3 py-1 text-xs font-bold text-white">Disabled</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Role & access</h2>
          <p className="mt-2 text-slate-800">{STAFF_DIRECTORY_ROLE_DESCRIPTIONS[row.role]}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Account</h2>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">User ID</dt>
              <dd className="font-mono text-xs text-slate-800">{row.uid}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Created</dt>
              <dd className="text-slate-800">
                {row.createdAt
                  ? row.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                  : "—"}
              </dd>
            </div>
            {row.createdByEmail ? (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Created by</dt>
                <dd className="text-right text-slate-800">{row.createdByEmail}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">Activity log coming soon.</p>
    </div>
  );
}
