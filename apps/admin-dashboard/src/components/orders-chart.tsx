"use client";

import { memo } from "react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line } from "recharts";

type OrdersChartProps = {
  ordersPerDay: Array<{ day: string; orders: number }>;
  revenuePerDay: Array<{ day: string; revenue: number }>;
};

function OrdersChartComponent({ ordersPerDay, revenuePerDay }: OrdersChartProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="h-72 rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-4 font-semibold">Orders per Day</h3>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={ordersPerDay}>
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="orders" fill="#FF6B35" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-72 rounded-2xl bg-white p-4 shadow">
        <h3 className="mb-4 font-semibold">Revenue per Day</h3>
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={revenuePerDay}>
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="revenue" stroke="#2EC4B6" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export const OrdersChart = memo(OrdersChartComponent);
