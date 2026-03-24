"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/providers/toast-provider";
import { buildAuthHeaders } from "@/lib/user-session";

type OrderHistory = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
};

export default function ProfilePage() {
  const { showToast } = useToast();
  const [fullName, setFullName] = useState("Ahmed Khan");
  const [email, setEmail] = useState("ahmed@example.com");
  const [phone, setPhone] = useState("+91 9XXXXXXXXX");
  const [addresses, setAddresses] = useState<string[]>(["Banjara Hills, Hyderabad", "Hitech City, Hyderabad"]);
  const [newAddress, setNewAddress] = useState("");
  const [history, setHistory] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const profileRaw = window.localStorage.getItem("nausheen_profile_cache");
    if (profileRaw) {
      try {
        const profile = JSON.parse(profileRaw) as { fullName: string; email: string; phone: string; addresses: string[] };
        setFullName(profile.fullName);
        setEmail(profile.email);
        setPhone(profile.phone);
        setAddresses(profile.addresses);
      } catch {
        window.localStorage.removeItem("nausheen_profile_cache");
      }
    }

    async function loadProfile() {
      setError(null);
      try {
        const headers = await buildAuthHeaders();
        const [profileRes, ordersRes] = await Promise.all([
          fetch("/api/user/profile", { headers }),
          fetch("/api/user/orders", { headers })
        ]);

        const profileData = (await profileRes.json()) as {
          profile?: { fullName: string; email: string; phone: string; addresses: string[] };
          error?: string;
        };
        if (profileRes.ok && profileData.profile) {
          setFullName(profileData.profile.fullName);
          setEmail(profileData.profile.email);
          setPhone(profileData.profile.phone);
          setAddresses(profileData.profile.addresses);
          window.localStorage.setItem("nausheen_profile_cache", JSON.stringify(profileData.profile));
        }

        const orderData = (await ordersRes.json()) as { items?: OrderHistory[]; error?: string };
        if (ordersRes.ok && Array.isArray(orderData.items)) {
          setHistory(orderData.items ?? []);
          window.localStorage.setItem("nausheen_orders_cache", JSON.stringify(orderData.items ?? []));
        } else if (!ordersRes.ok) {
          throw new Error(orderData.error ?? "Failed to load profile data.");
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  async function saveProfile() {
    try {
      const payload = { fullName, email, phone, addresses };
      const headers = await buildAuthHeaders({ "Content-Type": "application/json" });
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        showToast({
          title: "Save failed",
          description: "Could not update your profile",
          type: "error"
        });
        return;
      }
      window.localStorage.setItem("nausheen_profile_cache", JSON.stringify(payload));
      showToast({
        title: "Profile saved",
        description: "Your changes have been updated"
      });
    } catch {
      showToast({
        title: "Save failed",
        description: "Could not update your profile right now",
        type: "error"
      });
    }
  }

  function addAddress() {
    if (!newAddress.trim()) return;
    setAddresses((prev) => [...prev, newAddress.trim()]);
    setNewAddress("");
  }

  function triggerEmailVerification() {
    showToast({
      title: "Verification email sent",
      description: `Please check ${email}`
    });
  }

  return (
    <section className="space-y-5">
      <h1 className="text-3xl font-bold">Profile</h1>
      {loading ? <p className="text-sm text-slate-500">Loading profile...</p> : null}
      {!loading && error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="Full name"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="Phone"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="Email"
          />
          <button onClick={triggerEmailVerification} className="rounded-lg border px-3 py-2 text-xs dark:border-slate-700">
            Verify Email
          </button>
          <button onClick={saveProfile} className="rounded-lg bg-orange-500 px-3 py-2 text-xs text-white">
            Save
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">OTP login enabled</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-2 font-semibold">Saved Addresses</h2>
          <div className="space-y-1">
            {addresses.map((address) => (
              <p key={address} className="text-sm">
                {address}
              </p>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="Add new address"
            />
            <button onClick={addAddress} className="rounded-lg border px-3 py-2 text-xs dark:border-slate-700">
              Add
            </button>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-2 font-semibold">Rewards</h2>
          <p className="text-2xl font-bold text-brand-accent">{Math.max(120, history.length * 40)} pts</p>
          <p className="text-sm text-slate-500">Use points on your next order.</p>
        </div>
      </div>
      <div className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-2 font-semibold">Order History</h2>
        <p className="mb-2 text-sm text-slate-500">Total orders: {history.length}</p>
        {!loading && history.length === 0 ? (
          <p className="mb-2 text-sm text-slate-500">No recent orders found.</p>
        ) : null}
        <Link href="/orders" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          View all orders
        </Link>
      </div>
    </section>
  );
}
