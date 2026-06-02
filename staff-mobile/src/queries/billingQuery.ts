import { collection, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

let billingQuery = null;

try {
  billingQuery = query(
    collection(db, "orders"),
    where("paymentStatus", "==", "pending"),
    where("status", "in", ["ready", "served"]),
    orderBy("createdAt", "desc")
  );
} catch (e) {
  console.log("Query error:", e);
}

export { billingQuery };
