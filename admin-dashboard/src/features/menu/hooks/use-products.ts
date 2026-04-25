"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import type { MenuItemRow } from "@/features/menu/menu-types";

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status}).`;
}

function normalizeProduct(row: Record<string, unknown> & { id: string }): MenuItemRow {
  const available = row.available !== false && row.availability !== false && row.isAvailable !== false;
  return {
    id: row.id,
    name: String(row.name ?? ""),
    price: Number(row.price ?? 0),
    categoryId: String(row.categoryId ?? row.category ?? ""),
    categoryName: String(row.categoryName ?? ""),
    imageUrl: String(row.imageUrl ?? row.image ?? ""),
    size: String(row.size ?? ""),
    ingredients: String(row.ingredients ?? row.description ?? ""),
    available
  };
}

export function useProducts() {
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/menu");
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      const data = (await res.json()) as { items?: unknown[] };
      const raw = Array.isArray(data.items) ? data.items : [];
      setItems(
        raw
          .map((row) => {
            if (!row || typeof row !== "object" || !("id" in row)) return null;
            return normalizeProduct(row as Record<string, unknown> & { id: string });
          })
          .filter((x): x is MenuItemRow => Boolean(x))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { items, loading, error, refetch };
}
