"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderStatusTracker } from "@/components/orders/order-status-tracker";
import { RequireAuth } from "@/components/auth/require-auth";

function OrderTrackBody() {
  const params = useParams();
  const orderId = typeof params?.orderId === "string" ? params.orderId : "";

  if (!orderId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-slate-500">
        <p>Missing order id.</p>
        <Link href="/orders" className="mt-4 inline-block text-sm font-semibold text-orange-600">
          Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-20 pt-4">
      <Link
        href="/orders"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-400"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Your orders
      </Link>

      <h1 className="mb-4 text-xl font-bold text-slate-900 dark:text-slate-50">Track order</h1>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        Status updates in real time from the restaurant. Same account as checkout is required for Firestore live sync;
        otherwise use the tracking link from your confirmation.
      </p>

      <OrderStatusTracker orderId={orderId} initialStatus="pending" />
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <RequireAuth
      modalTitle="Sign in to track your order"
      modalDescription="Use the same account you used at checkout so we can load your order from Firestore."
      fullPageLoginHref="/login?redirect=/orders"
      autoOpenModal
    >
      <OrderTrackBody />
    </RequireAuth>
  );
}
