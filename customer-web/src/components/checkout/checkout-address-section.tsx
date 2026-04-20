"use client";

import { Loader2, MapPin, Navigation, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useDeliveryAddress } from "@/context/delivery-address-context";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useToast } from "@/components/providers/toast-provider";
import { AddAddressDrawer } from "@/components/checkout/add-address-drawer";
import { AddressList } from "@/components/checkout/address-list";
import type { DeliveryAddress } from "@/lib/delivery-address-types";

type CheckoutAddressSectionProps = {
  /** Anchor id for sticky footer scroll */
  sectionId?: string;
  /** Scroll target after "Deliver here" (e.g. payment block). */
  deliverHereScrollToId?: string;
};

export function CheckoutAddressSection({
  sectionId = "checkout-delivery",
  deliverHereScrollToId = "checkout-payment"
}: CheckoutAddressSectionProps) {
  const {
    addresses,
    selectedId,
    selectAddress,
    loading,
    addressesLoadError,
    setAddressAsDefault,
    removeAddress,
    checkoutDraftAddress,
    refreshAddresses
  } = useDeliveryAddress();
  const online = useOnlineStatus();
  const { showToast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryAddress | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openAdd = useCallback(() => {
    setEditing(null);
    setDrawerOpen(true);
  }, []);

  const openEdit = useCallback((id: string) => {
    const a = addresses.find((x) => x.id === id);
    if (a) {
      setEditing(a);
      setDrawerOpen(true);
    }
  }, [addresses]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this address?")) return;
      setBusyId(id);
      try {
        await removeAddress(id);
        showToast({ title: "Address removed", type: "success" });
      } catch (e) {
        console.error(e);
        showToast({
          type: "error",
          title: "Could not delete",
          description: e instanceof Error ? e.message : "Try again."
        });
      } finally {
        setBusyId(null);
      }
    },
    [removeAddress, showToast]
  );

  const handleSetDefault = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await setAddressAsDefault(id);
        selectAddress(id);
        showToast({ title: "Default address updated", type: "success" });
      } catch (e) {
        showToast({
          type: "error",
          title: "Could not update default",
          description: e instanceof Error ? e.message : "Try again."
        });
      } finally {
        setBusyId(null);
      }
    },
    [selectAddress, setAddressAsDefault, showToast]
  );

  return (
    <section id={sectionId} className="scroll-mt-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm">
          <MapPin className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Delivery address</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Choose where we should bring your order</p>
        </div>
      </div>

      {addressesLoadError ? (
        <div className="mb-3 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/35 dark:text-red-100">
          <p>{addressesLoadError}</p>
          <button
            type="button"
            onClick={() => {
              void refreshAddresses().then(() =>
                showToast({ title: "Refreshed", description: "Address list updated if you are online." })
              );
            }}
            className="mt-2 text-xs font-semibold text-red-800 underline-offset-2 hover:underline dark:text-red-200"
          >
            Try again
          </button>
        </div>
      ) : null}

      {loading ? (
        online ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-6 dark:border-slate-700 dark:bg-slate-900/50">
            <Loader2 className="h-5 w-5 animate-spin text-orange-500" aria-hidden />
            <span className="text-sm text-slate-600 dark:text-slate-300">Loading your addresses…</span>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-medium">You are offline</p>
            <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90">
              Connect to the internet to sync saved addresses. If you already loaded them once, they may still appear below.
            </p>
          </div>
        )
      ) : addresses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center dark:border-slate-600 dark:bg-slate-900/40">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">No saved addresses yet</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Add where we should deliver. It will be saved to your account for next time.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-4 w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-orange-600 sm:w-auto sm:px-8"
          >
            Add delivery address
          </button>
        </div>
      ) : (
        <>
          {checkoutDraftAddress && !addresses.some((a) => a.id === checkoutDraftAddress.id) ? (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              Offline / pending address in use for this order. It will sync when you are back online.
            </p>
          ) : null}

          <AddressList
            addresses={addresses}
            selectedId={selectedId}
            onSelect={selectAddress}
            onEdit={openEdit}
            onDelete={handleDelete}
            onSetDefault={handleSetDefault}
            busyId={busyId}
          />

          {selectedId && addresses.some((a) => a.id === selectedId) ? (
            <button
              type="button"
              onClick={() =>
                document.getElementById(deliverHereScrollToId)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start"
                })
              }
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              <Navigation className="h-4 w-4" aria-hidden />
              Deliver here
            </button>
          ) : null}

          <button
            type="button"
            onClick={openAdd}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-transparent py-3.5 text-sm font-semibold text-slate-700 transition hover:border-orange-400 hover:bg-orange-50/50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-orange-700 dark:hover:bg-orange-950/20"
          >
            <Plus className="h-4 w-4" />
            Add new address
          </button>
        </>
      )}

      <AddAddressDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditing(null);
        }}
        editing={editing}
        onSaved={() => setEditing(null)}
      />
    </section>
  );
}
