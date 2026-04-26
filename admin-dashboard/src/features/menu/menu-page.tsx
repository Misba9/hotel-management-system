"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { adminApiFetch } from "@/shared/lib/admin-api";
import { MenuToast, type MenuToastPayload } from "@/features/menu/menu-toast";
import { MenuDeleteDialog } from "@/features/menu/menu-delete-dialog";
import { ProductModal } from "@/features/menu/product-modal";
import { CategorySection } from "@/features/menu/category-section";
import { ProductSection } from "@/features/menu/product-section";
import { useCategories } from "@/features/menu/hooks/use-categories";
import { useProducts } from "@/features/menu/hooks/use-products";
import type { MenuItemRow, MenuProductFormValues } from "@/features/menu/menu-types";

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status}).`;
}

export function MenuPageFeature() {
  const { categories, loading: catLoading, error: catError, refetch: refetchCategories, categoryNameById } =
    useCategories();
  const { items, loading: prodLoading, error: prodError, refetch: refetchProducts } = useProducts();

  const [toast, setToast] = useState<MenuToastPayload>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productDraftId, setProductDraftId] = useState<string | null>(null);
  const [modalInitial, setModalInitial] = useState<MenuProductFormValues | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const showToast = useCallback((next: MenuToastPayload) => {
    setToast(next);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const activeCategories = useMemo(() => categories.filter((c) => c.isActive), [categories]);

  const fallbackCategoryId = useMemo(() => activeCategories[0]?.id ?? "", [activeCategories]);

  const categoriesForSelect = activeCategories;

  const refreshCategoriesAndProducts = useCallback(async () => {
    await refetchCategories();
    await refetchProducts();
  }, [refetchCategories, refetchProducts]);

  function openCreateModal() {
    if (activeCategories.length === 0) {
      showToast({ type: "error", message: "Create an active category before adding products." });
      return;
    }
    try {
      const id = doc(collection(getFirebaseDb(), "products")).id;
      setProductDraftId(id);
    } catch {
      showToast({ type: "error", message: "Could not prepare product id. Check Firebase configuration." });
      return;
    }
    setModalMode("create");
    setEditingId(null);
    setModalInitial(null);
    setProductModalOpen(true);
  }

  function openEditModal(item: MenuItemRow) {
    setModalMode("edit");
    setEditingId(item.id);
    setProductDraftId(null);
    setModalInitial({
      name: item.name,
      price: item.price,
      categoryId: item.categoryId ?? fallbackCategoryId,
      imageUrl: item.imageUrl ?? "",
      size: item.size ?? "",
      ingredients: item.ingredients ?? "",
      available: item.available
    });
    setProductModalOpen(true);
  }

  async function handleModalSubmit(values: MenuProductFormValues) {
    setModalSubmitting(true);
    const categoryName = categoryNameById.get(values.categoryId) ?? "";
    try {
      if (modalMode === "create") {
        const res = await adminApiFetch("/api/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: productDraftId ?? undefined,
            name: values.name,
            price: values.price,
            categoryId: values.categoryId,
            categoryName,
            size: values.size,
            ingredients: values.ingredients,
            imageUrl: values.imageUrl,
            available: values.available,
            isAvailable: values.available
          })
        });
        if (!res.ok) {
          showToast({ type: "error", message: await readApiError(res) });
          return;
        }
        showToast({ type: "success", message: "Product added." });
      } else if (editingId) {
        const priceNum = Number(values.price);
        if (!Number.isFinite(priceNum) || priceNum < 0) {
          showToast({ type: "error", message: "Invalid price." });
          return;
        }
        const payload = {
          name: values.name.trim(),
          price: priceNum,
          categoryId: values.categoryId,
          categoryName: (categoryNameById.get(values.categoryId) ?? "").trim(),
          size: (values.size ?? "").trim(),
          ingredients: (values.ingredients ?? "").trim(),
          imageUrl: (values.imageUrl ?? "").trim(),
          available: values.available,
          isAvailable: values.available
        };
        if (process.env.NODE_ENV === "development") {
          console.log("[admin/menu] Updating product payload:", payload);
        }
        const res = await adminApiFetch(`/api/menu/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          showToast({ type: "error", message: await readApiError(res) });
          return;
        }
        showToast({ type: "success", message: "Product updated." });
      }
      setProductModalOpen(false);
      setModalInitial(null);
      setEditingId(null);
      setProductDraftId(null);
      await refetchProducts();
    } catch (e) {
      showToast({ type: "error", message: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setModalSubmitting(false);
    }
  }

  async function toggleAvailable(item: MenuItemRow) {
    try {
      const res = await adminApiFetch(`/api/menu/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !item.available })
      });
      if (!res.ok) {
        showToast({ type: "error", message: await readApiError(res) });
        return;
      }
      showToast({
        type: "success",
        message: !item.available ? "Product is now available." : "Product hidden from menu."
      });
      await refetchProducts();
    } catch (e) {
      showToast({ type: "error", message: e instanceof Error ? e.message : "Update failed." });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      const res = await adminApiFetch(`/api/menu/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        showToast({ type: "error", message: await readApiError(res) });
        return;
      }
      showToast({ type: "success", message: "Product deleted." });
      const removedId = deleteTarget.id;
      setDeleteTarget(null);
      if (editingId === removedId) {
        setProductModalOpen(false);
        setEditingId(null);
      }
      await refetchProducts();
    } catch (e) {
      showToast({ type: "error", message: e instanceof Error ? e.message : "Delete failed." });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const storageTargetProductId = modalMode === "create" ? productDraftId : editingId;

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Menu management</h2>
        <p className="mt-1 text-sm text-slate-600">Categories first, then products. Changes apply to Firebase immediately.</p>
      </div>

      {catError ? (
        <p className="text-sm text-red-600">
          Categories: {catError}{" "}
          <button type="button" className="font-medium underline" onClick={() => void refetchCategories()}>
            Retry
          </button>
        </p>
      ) : null}

      <CategorySection
        categories={categories}
        loading={catLoading}
        onRefresh={refreshCategoriesAndProducts}
        onToast={showToast}
      />

      <ProductSection
        items={items}
        loading={prodLoading}
        error={prodError}
        categoryNameById={categoryNameById}
        canAdd={activeCategories.length > 0}
        onAdd={openCreateModal}
        onEdit={openEditModal}
        onDelete={(item) => setDeleteTarget({ id: item.id, name: item.name })}
        onToggleAvailable={toggleAvailable}
        onRetry={() => void refetchProducts()}
      />

      <ProductModal
        open={productModalOpen}
        onClose={() => {
          if (modalSubmitting) return;
          setProductModalOpen(false);
          setProductDraftId(null);
          setEditingId(null);
          setModalInitial(null);
        }}
        mode={modalMode}
        initial={modalInitial}
        categories={categoriesForSelect}
        fallbackCategoryId={fallbackCategoryId}
        submitting={modalSubmitting}
        storageTargetProductId={storageTargetProductId}
        onSubmit={handleModalSubmit}
        onToast={showToast}
      />

      <MenuDeleteDialog
        open={!!deleteTarget}
        title="Delete product?"
        itemName={deleteTarget?.name ?? ""}
        submitting={deleteSubmitting}
        onCancel={() => !deleteSubmitting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <MenuToast toast={toast} onDismiss={() => setToast(null)} />
    </section>
  );
}
