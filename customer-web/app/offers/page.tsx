"use client";

import { useEffect, useState } from "react";

type Offer = {
  code: string;
  title: string;
  expiresAt?: string;
};

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOffers() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/offers");
        const payload = (await response.json()) as { success?: boolean; offers?: Offer[]; error?: string };
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Failed to load offers.");
        }
        setOffers(payload.offers ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load offers.");
      } finally {
        setLoading(false);
      }
    }

    void loadOffers();
  }, []);

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Offers</h1>
      {loading ? <p className="text-sm text-slate-500">Loading offers...</p> : null}
      {!loading && error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {!loading && !error && offers.length === 0 ? (
        <p className="rounded-xl border bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900">
          No active offers right now. Please check back later.
        </p>
      ) : null}
      {offers.map((offer) => (
        <div key={offer.code} className="rounded-2xl bg-gradient-to-r from-amber-100 to-orange-100 p-4">
          <p className="font-semibold">{offer.code}</p>
          <p className="text-sm text-slate-600">{offer.title}</p>
          {offer.expiresAt ? <p className="mt-1 text-xs text-slate-500">Expires: {new Date(offer.expiresAt).toLocaleDateString()}</p> : null}
        </div>
      ))}
    </section>
  );
}
