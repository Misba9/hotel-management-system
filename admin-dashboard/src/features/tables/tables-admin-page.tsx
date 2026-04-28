"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { LayoutGrid, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";

type TableDoc = {
  id: string;
  name: string;
  status: string;
};

export function TablesAdminPage() {
  const { user } = useAuth();
  const [tables, setTables] = useState<TableDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const db = getFirebaseDb();
    const unsub = onSnapshot(
      collection(db, "tables"),
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            name: String(data.name ?? "").trim() || d.id,
            status: String(data.status ?? "available").toLowerCase()
          };
        });
        rows.sort((a, b) => a.name.localeCompare(b.name));
        setTables(rows);
        setLoading(false);
        setError(null);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const addTable = useCallback(async () => {
    const n = name.trim();
    if (!n) return;
    setAdding(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      const num = parseInt(n.replace(/\D/g, ""), 10);
      await addDoc(collection(db, "tables"), {
        name: n,
        status: "available",
        ...(Number.isFinite(num) && num > 0 ? { tableNumber: num } : {}),
        createdAt: serverTimestamp()
      });
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add table.");
    } finally {
      setAdding(false);
    }
  }, [name]);

  async function removeTable(id: string) {
    setError(null);
    try {
      await deleteDoc(doc(getFirebaseDb(), "tables", id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  async function toggleStatus(t: TableDoc) {
    setError(null);
    const next = t.status === "occupied" ? "available" : "occupied";
    try {
      await updateDoc(doc(getFirebaseDb(), "tables", t.id), { status: next });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Tables</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Floor tables sync in real time to the waiter app (Firestore <code className="text-xs">tables</code>
            ).
          </p>
        </div>
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <LayoutGrid className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-sm font-medium">{tables.length} total</span>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Add table</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Name appears in the waiter app (e.g. T1, Patio 2).</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Table name"
            className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm outline-none ring-orange-500/30 placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="button"
            disabled={adding || !name.trim()}
            onClick={() => void addTable()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            Add
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">All tables</h2>
        {loading ? (
          <div className="flex items-center gap-2 py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : tables.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No tables yet. Add one above.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {tables.map((t) => {
              const occ = t.status === "occupied" || t.status === "OCCUPIED";
              return (
                <li key={t.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{t.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">id: {t.id}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        occ
                          ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                      }`}
                    >
                      {occ ? "occupied" : "available"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void toggleStatus(t)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Toggle status
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeTable(t.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
