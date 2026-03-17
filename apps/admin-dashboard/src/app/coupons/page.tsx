"use client";

import { useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api";

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Array<{ id: string; code: string; usageLimit: number; usedCount: number; expiryAt: string }>>([]);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("10");
  const [expiryAt, setExpiryAt] = useState("");

  async function loadCoupons() {
    const res = await adminApiFetch("/api/coupons");
    const data = (await res.json()) as {
      items: Array<{ id: string; code: string; usageLimit: number; usedCount: number; expiryAt: string }>;
    };
    setCoupons(data.items ?? []);
  }

  useEffect(() => {
    void loadCoupons();
  }, []);

  async function createCoupon() {
    if (!code.trim() || !expiryAt) return;
    await adminApiFetch("/api/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim(), discountValue: Number(discount), expiryAt })
    });
    setCode("");
    setDiscount("10");
    setExpiryAt("");
    await loadCoupons();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Coupon System</h2>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" className="rounded border px-3 py-2 text-sm" />
          <input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Discount %" className="w-24 rounded border px-3 py-2 text-sm" />
          <input value={expiryAt} onChange={(e) => setExpiryAt(e.target.value)} type="date" className="rounded border px-3 py-2 text-sm" />
          <button onClick={createCoupon} className="rounded bg-orange-500 px-3 py-2 text-sm text-white">Create Coupon</button>
        </div>
      </div>
      {coupons.map((coupon) => (
        <div key={coupon.id} className="rounded-xl bg-white p-4 shadow">
          <p className="font-semibold">{coupon.code}</p>
          <p className="text-sm text-gray-500">
            Usage: {coupon.usedCount}/{coupon.usageLimit} | Expiry: {coupon.expiryAt}
          </p>
        </div>
      ))}
    </section>
  );
}
