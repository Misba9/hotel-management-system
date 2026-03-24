"use client";

import { useEffect, useState } from "react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { RequestState } from "@/components/admin/request-state";

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<
    Array<{
      id: string;
      code: string;
      usageLimit: number;
      usedCount: number;
      expiryAt: string;
      discountType?: "flat" | "percent";
      discountValue?: number;
      minOrderAmount?: number;
      active?: boolean;
    }>
  >([]);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [discount, setDiscount] = useState("10");
  const [usageLimit, setUsageLimit] = useState("100");
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [expiryAt, setExpiryAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCoupons() {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/coupons");
      if (!res.ok) {
        setError("Failed to load coupons.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        items: Array<{
          id: string;
          code: string;
          usageLimit: number;
          usedCount: number;
          expiryAt: string;
          discountType?: "flat" | "percent";
          discountValue?: number;
          minOrderAmount?: number;
          active?: boolean;
        }>;
      };
      setCoupons(data.items ?? []);
    } catch {
      setError("Failed to load coupons.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCoupons();
  }, []);

  async function createCoupon() {
    if (!code.trim() || !expiryAt) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discountType,
          discountValue: Number(discount),
          minOrderAmount: Number(minOrderAmount),
          usageLimit: Number(usageLimit),
          expiryAt
        })
      });
      if (!res.ok) {
        setError("Failed to create coupon.");
        setSaving(false);
        return;
      }
      setCode("");
      setDiscountType("percent");
      setDiscount("10");
      setUsageLimit("100");
      setMinOrderAmount("0");
      setExpiryAt("");
      await loadCoupons();
    } catch {
      setError("Failed to create coupon.");
    } finally {
      setSaving(false);
    }
  }

  async function updateCoupon(id: string, payload: Record<string, unknown>) {
    setError(null);
    try {
      const res = await adminApiFetch(`/api/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setError("Failed to update coupon.");
        return;
      }
      await loadCoupons();
    } catch {
      setError("Failed to update coupon.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Coupon System</h2>
        <div className="flex flex-wrap gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" className="rounded border px-3 py-2 text-sm" />
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "flat")} className="rounded border px-3 py-2 text-sm">
            <option value="percent">Percent</option>
            <option value="flat">Flat</option>
          </select>
          <input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Discount %" className="w-24 rounded border px-3 py-2 text-sm" />
          <input value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Usage limit" className="w-28 rounded border px-3 py-2 text-sm" />
          <input
            value={minOrderAmount}
            onChange={(e) => setMinOrderAmount(e.target.value)}
            placeholder="Min order"
            className="w-28 rounded border px-3 py-2 text-sm"
          />
          <input value={expiryAt} onChange={(e) => setExpiryAt(e.target.value)} type="date" className="rounded border px-3 py-2 text-sm" />
          <button onClick={createCoupon} disabled={saving} className="rounded bg-orange-500 px-3 py-2 text-sm text-white disabled:opacity-60">
            {saving ? "Creating..." : "Create Coupon"}
          </button>
        </div>
      </div>
      <RequestState error={error} loading={loading} empty={coupons.length === 0} loadingMessage="Loading coupons..." emptyMessage="No coupons found." />
      {coupons.map((coupon) => (
        <div key={coupon.id} className="rounded-xl bg-white p-4 shadow">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{coupon.code}</p>
            <button onClick={() => void updateCoupon(coupon.id, { active: !(coupon.active ?? true) })} className="rounded border px-2 py-1 text-xs">
              {coupon.active ?? true ? "Deactivate" : "Activate"}
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Usage: {coupon.usedCount}/{coupon.usageLimit} | Expiry: {coupon.expiryAt}
          </p>
          <p className="text-sm text-gray-500">
            {coupon.discountType ?? "percent"}: {coupon.discountValue ?? 0} | Min order: {coupon.minOrderAmount ?? 0}
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => void updateCoupon(coupon.id, { usageLimit: coupon.usageLimit + 10 })} className="rounded border px-2 py-1 text-xs">
              +10 limit
            </button>
            <button
              onClick={() => void updateCoupon(coupon.id, { expiryAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })}
              className="rounded border px-2 py-1 text-xs"
            >
              Extend 7 days
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
