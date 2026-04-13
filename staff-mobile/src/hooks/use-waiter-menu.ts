import { useCallback, useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { staffDb } from "../lib/firebase";
import { MENU_COLLECTION, type MenuDocumentItem } from "./use-menu-collection";

const MENU_ITEMS_COLLECTION = "menu_items" as const;

function normalizeSimpleMenuDoc(id: string, raw: Record<string, unknown>): MenuDocumentItem | null {
  const available = raw.available !== false && raw.isAvailable !== false;
  if (!available) return null;
  const name = String(raw.name ?? "").trim();
  if (!name) return null;
  const price = Number(raw.price ?? 0);
  if (!Number.isFinite(price) || price < 0) return null;
  return { id, name, price };
}

function mergeMenuMaps(
  fromMenu: Map<string, MenuDocumentItem>,
  fromMenuItems: Map<string, MenuDocumentItem>
): MenuDocumentItem[] {
  const out = new Map<string, MenuDocumentItem>(fromMenu);
  fromMenuItems.forEach((row, id) => out.set(id, row));
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export type UseWaiterMenuResult = {
  items: MenuDocumentItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Real-time menu for table orders: merges `menu` and `menu_items` (admin dashboard uses `menu_items`;
 * simple `menu` docs still work). `menu_items` wins on duplicate ids.
 */
export function useWaiterMenu(enabled = true): UseWaiterMenuResult {
  const [items, setItems] = useState<MenuDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const menuMapRef = useRef(new Map<string, MenuDocumentItem>());
  const menuItemsMapRef = useRef(new Map<string, MenuDocumentItem>());
  const menuOkRef = useRef(false);
  const itemsOkRef = useRef(false);
  const menuErrRef = useRef<string | null>(null);
  const itemsErrRef = useRef<string | null>(null);

  const refresh = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    menuMapRef.current = new Map();
    menuItemsMapRef.current = new Map();
    menuOkRef.current = false;
    itemsOkRef.current = false;
    menuErrRef.current = null;
    itemsErrRef.current = null;
  }, [nonce]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const flush = () => {
      if (!menuOkRef.current || !itemsOkRef.current) return;
      if (menuErrRef.current && itemsErrRef.current) {
        setItems([]);
        setError(menuErrRef.current);
        setLoading(false);
        return;
      }
      setItems(mergeMenuMaps(menuMapRef.current, menuItemsMapRef.current));
      setError(null);
      setLoading(false);
    };

    const unsubMenu = onSnapshot(
      collection(staffDb, MENU_COLLECTION),
      (snap) => {
        const m = new Map<string, MenuDocumentItem>();
        snap.forEach((d) => {
          const row = normalizeSimpleMenuDoc(d.id, d.data() as Record<string, unknown>);
          if (row) m.set(d.id, row);
        });
        menuMapRef.current = m;
        menuOkRef.current = true;
        menuErrRef.current = null;
        flush();
      },
      (err) => {
        menuMapRef.current = new Map();
        menuOkRef.current = true;
        menuErrRef.current = err instanceof Error ? err.message : "Menu error.";
        flush();
      }
    );

    const unsubItems = onSnapshot(
      collection(staffDb, MENU_ITEMS_COLLECTION),
      (snap) => {
        const m = new Map<string, MenuDocumentItem>();
        snap.forEach((d) => {
          const row = normalizeSimpleMenuDoc(d.id, d.data() as Record<string, unknown>);
          if (row) m.set(d.id, row);
        });
        menuItemsMapRef.current = m;
        itemsOkRef.current = true;
        itemsErrRef.current = null;
        flush();
      },
      (err) => {
        menuItemsMapRef.current = new Map();
        itemsOkRef.current = true;
        itemsErrRef.current = err instanceof Error ? err.message : "Menu items error.";
        flush();
      }
    );

    return () => {
      unsubMenu();
      unsubItems();
    };
  }, [enabled, nonce]);

  return { items, loading, error, refresh };
}
