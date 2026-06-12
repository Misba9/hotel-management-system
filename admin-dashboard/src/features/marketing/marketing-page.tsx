"use client";

import { useEffect, useState } from "react";
import { Gift, Mail, Megaphone, MessageSquare, Percent, Share2, Smartphone } from "lucide-react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { PageShell } from "@/components/admin/page-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Coupon = {
  id: string;
  code: string;
  usageLimit: number;
  usedCount: number;
  expiryAt: string;
  discountType?: "flat" | "percent";
  discountValue?: number;
  active?: boolean;
};

export function MarketingPageFeature() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("10");
  const [saving, setSaving] = useState(false);

  async function loadCoupons() {
    setLoading(true);
    try {
      const res = await adminApiFetch("/api/coupons");
      if (res.ok) {
        const data = (await res.json()) as { items: Coupon[] };
        setCoupons(data.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCoupons();
  }, []);

  async function createCoupon() {
    if (!code.trim()) return;
    setSaving(true);
    try {
      const res = await adminApiFetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discountType: "percent",
          discountValue: Number(discount),
          usageLimit: 100,
          minOrderAmount: 0,
          expiryAt: new Date(Date.now() + 30 * 86400000).toISOString()
        })
      });
      if (res.ok) {
        setCode("");
        await loadCoupons();
      }
    } finally {
      setSaving(false);
    }
  }

  const campaigns = [
    { name: "Weekend Feast", channel: "Push", reach: "2.4k", status: "Active" },
    { name: "Monsoon Combo", channel: "SMS", reach: "890", status: "Scheduled" },
    { name: "Refer & Earn", channel: "Email", reach: "1.2k", status: "Active" }
  ];

  return (
    <PageShell badge="Marketing Hub" title="Marketing" description="Coupons · campaigns · push · SMS · referrals">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard title="Active Coupons" value={coupons.filter((c) => c.active !== false).length} icon={Percent} accent="orange" loading={loading} />
        <MetricCard title="Campaigns" value={3} icon={Megaphone} accent="violet" />
        <MetricCard title="Push Sent (7d)" value="4.2k" icon={Smartphone} accent="sky" />
        <MetricCard title="Gift Cards" value={12} icon={Gift} accent="emerald" />
      </div>

      <Tabs defaultValue="coupons">
        <TabsList className="flex-wrap">
          {[
            { id: "coupons", icon: Percent, label: "Coupons" },
            { id: "offers", icon: Megaphone, label: "Offers" },
            { id: "campaigns", icon: Share2, label: "Campaigns" },
            { id: "push", icon: Smartphone, label: "Push" },
            { id: "sms", icon: MessageSquare, label: "SMS" },
            { id: "email", icon: Mail, label: "Email" },
            { id: "referral", icon: Share2, label: "Referral" },
            { id: "giftcards", icon: Gift, label: "Gift Cards" }
          ].map(({ id, label }) => (
            <TabsTrigger key={id} value={id}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="coupons">
          <div className="grid gap-6 lg:grid-cols-3">
            <GlassCard hover className="lg:col-span-2">
              <h3 className="mb-4 font-semibold text-white">Active Coupons</h3>
              <div className="space-y-2">
                {coupons.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] p-3">
                    <div>
                      <p className="font-mono font-semibold text-brand-primary">{c.code}</p>
                      <p className="text-xs text-white/40">
                        {c.discountValue ?? 0}
                        {c.discountType === "flat" ? " Rs off" : "% off"} · Used {c.usedCount}/{c.usageLimit}
                      </p>
                    </div>
                    <Badge variant={c.active !== false ? "success" : "neutral"}>{c.active !== false ? "Active" : "Inactive"}</Badge>
                  </div>
                ))}
                {!loading && coupons.length === 0 ? <p className="py-8 text-center text-sm text-white/40">No coupons yet.</p> : null}
              </div>
            </GlassCard>
            <GlassCard hover>
              <h3 className="mb-4 font-semibold text-white">Create Coupon</h3>
              <div className="space-y-3">
                <Input placeholder="Code (e.g. SAVE20)" value={code} onChange={(e) => setCode(e.target.value)} />
                <Input placeholder="Discount %" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                <Button className="w-full" onClick={() => void createCoupon()} disabled={saving}>
                  {saving ? "Creating…" : "Create Coupon"}
                </Button>
              </div>
            </GlassCard>
          </div>
        </TabsContent>

        <TabsContent value="campaigns">
          <GlassCard hover>
            <h3 className="mb-4 font-semibold text-white">Campaign Analytics</h3>
            <div className="space-y-2">
              {campaigns.map((c) => (
                <div key={c.name} className="flex items-center justify-between rounded-xl border border-white/[0.06] p-3">
                  <div>
                    <p className="font-medium text-white">{c.name}</p>
                    <p className="text-xs text-white/40">
                      {c.channel} · Reach {c.reach}
                    </p>
                  </div>
                  <Badge variant="default">{c.status}</Badge>
                </div>
              ))}
            </div>
          </GlassCard>
        </TabsContent>

        {["offers", "push", "sms", "email", "referral", "giftcards"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <GlassCard>
              <p className="py-12 text-center text-sm capitalize text-white/40">{tab} — configure channels and audience segments.</p>
              <div className="flex justify-center">
                <Button>Create {tab.replace("cards", " Card")}</Button>
              </div>
            </GlassCard>
          </TabsContent>
        ))}
      </Tabs>
    </PageShell>
  );
}
