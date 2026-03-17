"use client";

import { useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api";

export default function BranchesPage() {
  const [branches, setBranches] = useState<Array<{ id: string; name: string; city: string; deliveryRadiusKm: number; active: boolean }>>([]);

  async function loadBranches() {
    const res = await adminApiFetch("/api/branches");
    const data = (await res.json()) as {
      items: Array<{ id: string; name: string; city: string; deliveryRadiusKm: number; active: boolean }>;
    };
    setBranches(data.items ?? []);
  }

  useEffect(() => {
    void loadBranches();
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Branch Management</h2>
        <button className="rounded bg-orange-500 px-3 py-2 text-sm text-white">Add Branch (API Ready)</button>
      </div>
      {branches.map((branch) => (
        <div key={branch.id} className="rounded-xl bg-white p-4 shadow">
          <p className="font-semibold">{branch.name}</p>
          <p className="text-sm text-gray-500">
            {branch.city} | Radius: {branch.deliveryRadiusKm}km
          </p>
          <p className="text-sm">{branch.active ? "Active" : "Inactive"}</p>
        </div>
      ))}
    </section>
  );
}
