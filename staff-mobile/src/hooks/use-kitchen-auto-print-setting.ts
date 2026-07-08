import { useCallback, useEffect, useState } from "react";

import { readKitchenAutoPrintEnabled, writeKitchenAutoPrintEnabled } from "../lib/kitchen-settings";

export function useKitchenAutoPrintSetting() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const value = await readKitchenAutoPrintEnabled();
    setEnabled(value);
    setReady(true);
    return value;
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setAutoPrintEnabled = useCallback(async (next: boolean) => {
    setSaving(true);
    setEnabled(next);
    try {
      await writeKitchenAutoPrintEnabled(next);
    } catch {
      await reload();
    } finally {
      setSaving(false);
    }
  }, [reload]);

  return {
    autoPrintEnabled: enabled,
    autoPrintReady: ready,
    savingAutoPrint: saving,
    setAutoPrintEnabled,
    reloadAutoPrintSetting: reload
  };
}
