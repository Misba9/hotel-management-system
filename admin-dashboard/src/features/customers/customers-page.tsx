"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp
} from "firebase/firestore";
import { ExternalLink, Loader2, MapPin, Search, Users, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getFirebaseDb } from "@/lib/firebase";

type CustomerAddress = {
  id: string;
  label: string;
  addressLine: string;
  city: string;
  lat: number;
  lng: number;
};

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: Date | null;
  addresses: CustomerAddress[];
};

function parseAddresses(raw: unknown): CustomerAddress[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomerAddress[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    if (!id) continue;
    const lat = typeof o.lat === "number" && Number.isFinite(o.lat) ? o.lat : 0;
    const lng = typeof o.lng === "number" && Number.isFinite(o.lng) ? o.lng : 0;
    out.push({
      id,
      label: String(o.label ?? "Home"),
      addressLine: String(o.addressLine ?? ""),
      city: String(o.city ?? ""),
      lat,
      lng
    });
  }
  return out;
}

function parseCustomerDoc(id: string, data: Record<string, unknown>): CustomerRow {
  let createdAt: Date | null = null;
  const c = data.createdAt;
  if (c && typeof c === "object" && "toDate" in c && typeof (c as Timestamp).toDate === "function") {
    createdAt = (c as Timestamp).toDate();
  }
  return {
    id,
    name: String(data.name ?? ""),
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
    createdAt,
    addresses: parseAddresses(data.addresses)
  };
}

function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function CustomersPageFeature() {
  const { user, authClaimsResolved, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<CustomerRow | null>(null);

  useEffect(() => {
    if (!authClaimsResolved || !user || !role) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    let unsub: (() => void) | null = null;
    try {
      const db = getFirebaseDb();
      const q = query(collection(db, "customers"), orderBy("createdAt", "desc"), limit(400));
      unsub = onSnapshot(
        q,
        (snap) => {
          if (cancelled) return;
          const next = snap.docs.map((d) => parseCustomerDoc(d.id, d.data() as Record<string, unknown>));
          setItems(next);
          setError(null);
          setLoading(false);
        },
        (err) => {
          if (cancelled) return;
          setError(err.message || "Could not subscribe to customers.");
          setLoading(false);
        }
      );
    } catch (e) {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : "Firestore is not available.");
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user, authClaimsResolved, role]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.phone.replace(/\s/g, "").toLowerCase().includes(q.replace(/\s/g, "")) ||
        r.phone.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [items, search]);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-md dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <Users className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Customers</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Live from Firestore · {items.length} loaded</p>
            </div>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, email…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none ring-brand-primary focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              aria-label="Search customers"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting to live customers…
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
                  <th className="px-2 py-2 font-semibold">Saved addresses</th>
                  <th className="px-2 py-2 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const n = row.addresses.length;
                  return (
                    <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-2 text-slate-900 dark:text-slate-100">{row.name || "—"}</td>
                      <td className="px-2 py-2">{row.phone || "—"}</td>
                      <td className="px-2 py-2">{row.email || "—"}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                          onClick={() => setDetail(row)}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          {n === 0 ? (
                            <span className="text-slate-500 dark:text-slate-400">No addresses</span>
                          ) : (
                            <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-violet-100 px-1.5 text-[11px] font-semibold text-violet-900 dark:bg-violet-900/50 dark:text-violet-100">
                              {n}
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        {row.createdAt ? row.createdAt.toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && filtered.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No customers match your search.</p>
            ) : null}
          </div>
        ) : null}

        {detail ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-addresses-title"
          >
            <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <h3 id="customer-addresses-title" className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  Addresses — {detail.name || detail.phone || detail.id}
                </h3>
                <button
                  type="button"
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  onClick={() => setDetail(null)}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
                {detail.addresses.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">No addresses</p>
                ) : null}
                <ul className="space-y-4">
                  {detail.addresses.map((a) => {
                    const hasCoords = a.lat !== 0 || a.lng !== 0;
                    const osm =
                      hasCoords &&
                      `https://staticmap.openstreetmap.de/staticmap.php?center=${a.lat},${a.lng}&zoom=16&size=600x200&markers=${a.lat},${a.lng},lightblue1`;
                    return (
                      <li
                        key={a.id}
                        className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50"
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900 dark:text-slate-100">{a.label}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">{a.addressLine}</p>
                        <p className="text-slate-600 dark:text-slate-400">{a.city}</p>
                        {hasCoords ? (
                          <div className="mt-2 space-y-2">
                            {osm ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={osm}
                                alt=""
                                className="h-36 w-full rounded-lg border border-slate-200 object-cover dark:border-slate-600"
                                loading="lazy"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : null}
                            <a
                              href={mapsLink(a.lat, a.lng)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
                            >
                              Open in Google Maps
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
