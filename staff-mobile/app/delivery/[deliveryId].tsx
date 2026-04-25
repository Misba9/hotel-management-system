import { useLocalSearchParams } from "expo-router";

import { DeliveryDetailView } from "@/components/Delivery/DeliveryDetailView";

export default function DeliveryDetailPage() {
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();
  return <DeliveryDetailView deliveryId={typeof deliveryId === "string" ? deliveryId : ""} />;
}
