import { getFirestore } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

const db = getFirestore();

const upsellMap: Record<string, string[]> = {
  mango_juice: ["fruit_bowl", "protein_smoothie"],
  banana_shake: ["mango_juice", "fruit_bowl"]
};

export const getUpsellSuggestions = onCall(async (request) => {
  const itemIds = (request.data?.itemIds as string[] | undefined) ?? [];
  const suggestions = new Set<string>();
  itemIds.forEach((id) => (upsellMap[id] ?? []).forEach((candidate) => suggestions.add(candidate)));

  const docs = await Promise.all(Array.from(suggestions).map((id) => db.collection("menu_items").doc(id).get()));
  return {
    suggestions: docs.filter((d) => d.exists).map((d) => d.data())
  };
});

export const grantLoyaltyPointsOnDelivered = onDocumentUpdated("orders/{orderId}", async (event) => {
  const before = event.data?.before.data() as { status?: string } | undefined;
  const after = event.data?.after.data() as { status?: string; userId?: string; total?: number } | undefined;
  if (!after?.userId || before?.status === "delivered" || after.status !== "delivered") return;

  const points = Math.floor(Number(after.total ?? 0) / 20);
  await db.collection("users").doc(after.userId).set(
    {
      loyaltyPoints: points
    },
    { merge: true }
  );
});
