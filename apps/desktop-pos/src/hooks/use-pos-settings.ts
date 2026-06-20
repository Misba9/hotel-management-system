import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { DEFAULT_POS_SETTINGS, POS_SETTINGS_DOC_ID, type PosSettingsDoc } from "@shared/types/pos-settings";
import { getStaffDb } from "@/lib/firebase";

export function usePosSettings() {
  const [settings, setSettings] = useState<PosSettingsDoc>(DEFAULT_POS_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getStaffDb();
    if (!db) {
      setSettings(DEFAULT_POS_SETTINGS);
      setLoading(false);
      return undefined;
    }
    const ref = doc(db, "settings", POS_SETTINGS_DOC_ID);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setSettings({ ...DEFAULT_POS_SETTINGS, ...(snap.data() as Partial<PosSettingsDoc>) });
        } else {
          setSettings(DEFAULT_POS_SETTINGS);
        }
        setLoading(false);
      },
      () => {
        setSettings(DEFAULT_POS_SETTINGS);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { settings, loading, taxPercent: settings.taxPercent };
}
