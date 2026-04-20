"use client";

import type { DeliveryAddress } from "@/lib/delivery-address-types";
import { AddressCard } from "@/components/checkout/address-card";

type AddressListProps = {
  addresses: DeliveryAddress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  busyId?: string | null;
};

export function AddressList({
  addresses,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  busyId
}: AddressListProps) {
  if (addresses.length === 0) return null;

  return (
    <ul className="space-y-3" role="list" aria-label="Saved addresses">
      {addresses.map((a) => (
        <li key={a.id}>
          <AddressCard
            address={a}
            selected={selectedId === a.id}
            onSelect={() => onSelect(a.id)}
            onEdit={() => onEdit(a.id)}
            onDelete={() => onDelete(a.id)}
            onSetDefault={() => onSetDefault(a.id)}
            disabled={busyId === a.id}
          />
        </li>
      ))}
    </ul>
  );
}
