import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { PRINTERS_COLLECTION_PATH } from "@shared/types/restaurant-firestore-schema";
import { getStaffDb } from "@/lib/firebase";

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
    const db = getStaffDb();
    if (!db) {
      setPrinters([]);
      setLoading(false);
      return undefined;
    }
    const unsub = onSnapshot(
      collection(db, PRINTERS_COLLECTION_PATH),
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
