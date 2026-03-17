import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const db = getFirestore();

export const exportDailyOrdersCsv = onCall(async (request) => {
  if (!request.auth?.token?.role || !["manager", "admin"].includes(String(request.auth.token.role))) {
    throw new HttpsError("permission-denied", "Manager/admin role required.");
  }

  const dayKey = String(request.data?.dayKey ?? new Date().toISOString().slice(0, 10));
  const ordersSnap = await db.collection("orders").where("dayKey", "==", dayKey).get();

  const rows = ["orderId,userId,status,total,orderType,paymentMethod,createdAt"];
  ordersSnap.docs.forEach((doc) => {
    const d = doc.data();
    rows.push(
      [doc.id, d.userId, d.status, d.total, d.orderType, d.paymentMethod, d.createdAt]
        .map((v) => `"${String(v ?? "")}"`)
        .join(",")
    );
  });

  return { dayKey, csv: rows.join("\n") };
});
