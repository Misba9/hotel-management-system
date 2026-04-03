"use client";

import { memo } from "react";

export type KpiCardProps = {
  label: string;
  value: string;
};

function KpiCardComponent({ label, value }: KpiCardProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export const KpiCard = memo(KpiCardComponent);

