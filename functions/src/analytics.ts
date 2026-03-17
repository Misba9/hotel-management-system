import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const db = getFirestore();

export const getAdminAnalytics = onCall(async (request) => {
  if (!request.auth?.token?.role || !["manager", "admin"].includes(String(request.auth.token.role))) {
    throw new HttpsError("permission-denied", "Manager/admin role required.");
  }

  const dayKey = (request.data?.dayKey as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const ordersSnap = await db.collection("orders").where("dayKey", "==", dayKey).get();

  const orders = ordersSnap.docs.map((d) => d.data() as { total: number; status: string });
  const totalOrders = orders.length;
  const revenue = orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const delivered = orders.filter((o) => o.status === "delivered").length;

  return {
    dayKey,
    totalOrders,
    revenue,
    delivered
  };
});
