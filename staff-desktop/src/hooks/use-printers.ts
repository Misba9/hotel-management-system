import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { PRINTERS_COLLECTION_PATH } from "@shared/types/restaurant-firestore-schema";
import { staffDb } from "@/lib/staff-db";

export type PrinterRow = {
  id: string;
  name: string;
  type: "wifi" | "bluetooth";
  role?: "counter" | "kitchen";
  ipAddress?: string;
};

export function usePrinters() {
  const [printers, setPrinters] = useState<PrinterRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(staffDb, PRINTERS_COLLECTION_PATH),
      (snap) => {
        setPrinters(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PrinterRow, "id">)
          }))
        );
        setLoading(false);
      },
      () => {
        setPrinters([]);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { printers, loading };
}
