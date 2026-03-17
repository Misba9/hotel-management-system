import crypto from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";

const db = getFirestore();

export const verifyRazorpayPayment = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Login required.");
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = request.data as {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  };

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new HttpsError("failed-precondition", "Missing Razorpay secret.");

  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (expected !== razorpaySignature) {
    throw new HttpsError("invalid-argument", "Invalid payment signature.");
  }

  const paymentSnap = await db.collection("payments").where("orderId", "==", orderId).limit(1).get();
  if (paymentSnap.empty) throw new HttpsError("not-found", "Payment not found.");
  const paymentRef = paymentSnap.docs[0].ref;

  await paymentRef.update({
    status: "paid",
    razorpayOrderId,
    razorpayPaymentId,
    verifiedAt: new Date().toISOString()
  });

  return { ok: true };
});

export const razorpayWebhook = onRequest(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];
  if (!secret || typeof signature !== "string") {
    res.status(401).send("Unauthorized");
    return;
  }

  const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(req.body)).digest("hex");
  if (expected !== signature) {
    res.status(401).send("Invalid signature");
    return;
  }

  const event = req.body?.event as string | undefined;
  const paymentEntity = req.body?.payload?.payment?.entity;
  if (event === "payment.captured" && paymentEntity?.order_id) {
    const paymentSnap = await db
      .collection("payments")
      .where("razorpayOrderId", "==", paymentEntity.order_id)
      .limit(1)
      .get();
    if (!paymentSnap.empty) {
      await paymentSnap.docs[0].ref.update({
        status: "paid",
        razorpayPaymentId: paymentEntity.id,
        verifiedAt: new Date().toISOString()
      });
    }
  }

  res.status(200).json({ ok: true });
});
