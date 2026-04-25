"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApiFetch } from "@/shared/lib/admin-api";
import type { CategoryRow } from "@/features/menu/menu-types";

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status}).`;
}

function normalizeCategory(doc: Record<string, unknown> & { id: string }): CategoryRow {
  const isActive = doc.isActive !== false && doc.active !== false;
  return {
    id: doc.id,
    name: String(doc.name ?? ""),
    imageUrl: String(doc.imageUrl ?? ""),
    isActive,
    priority: typeof doc.priority === "number" ? doc.priority : 50
  };
}

export function useCategories() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/categories");
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      const data = (await res.json()) as { items?: unknown[] };
      const raw = Array.isArray(data.items) ? data.items : [];
      setCategories(
        raw
          .map((row) => {
            if (!row || typeof row !== "object" || !("id" in row)) return null;
            return normalizeCategory(row as Record<string, unknown> & { id: string });
          })
          .filter((x): x is CategoryRow => Boolean(x))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  return { categories, loading, error, refetch, categoryNameById };
}
