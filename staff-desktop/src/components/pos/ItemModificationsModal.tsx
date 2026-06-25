import { useEffect, useState } from "react";
import { Modal } from "@/components/modals/Modal";
import { POS_ITEM_MODIFICATIONS } from "@/components/pos/pos-types";

type ItemModificationsModalProps = {
  open: boolean;
  productName: string;
  initialModifications?: string[];
  initialNote?: string;
  onClose: () => void;
  onSave: (mods: string[], note: string) => void;
};

export function ItemModificationsModal({
  open,
  productName,
  initialModifications = [],
  initialNote = "",
  onClose,
  onSave
}: ItemModificationsModalProps) {
  const [draftMods, setDraftMods] = useState<string[]>(initialModifications);
  const [draftNote, setDraftNote] = useState(initialNote);

  useEffect(() => {
    if (!open) return;
    setDraftMods(initialModifications);
    setDraftNote(initialNote);
  }, [open, initialModifications, initialNote]);

  const toggleMod = (mod: string) => {
    setDraftMods((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]));
  };

  return (
    <Modal open={open} onClose={onClose} title="Item modifications" widthClass="max-w-md">
      <div className="space-y-4 p-5">
        <p className="text-sm font-semibold text-slate-500">{productName}</p>
        <div className="flex flex-wrap gap-2">
          {POS_ITEM_MODIFICATIONS.map((mod) => {
            const on = draftMods.includes(mod);
            return (
              <button
                key={mod}
                type="button"
                onClick={() => toggleMod(mod)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  on
                    ? "bg-brand-teal text-white"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {mod}
              </button>
            );
          })}
        </div>
        <textarea
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          placeholder="Other instructions (e.g. less sweet)"
          rows={3}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold dark:border-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draftMods, draftNote.trim())}
            className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

import { formatItemExtras } from "@/lib/pos/format-item-extras";

export { formatItemExtras as formatLineExtras };
