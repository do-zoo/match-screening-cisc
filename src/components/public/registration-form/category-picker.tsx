"use client";

import type { SerializedTicketCategory } from "@/components/public/event-serialization";
import { formatIdr } from "@/lib/utils/format-idr";

type Props = {
  categories: SerializedTicketCategory[];
  selectedId: string;
  onSelect: (id: string) => void;
  qty: number;
  onQtyChange: (qty: number) => void;
};

export function CategoryPicker({ categories, selectedId, onSelect, qty, onQtyChange }: Props) {
  const selected = categories.find((c) => c.id === selectedId);
  const max = selected?.maxQtyPerPerson ?? 20;

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium mb-2">Pilih Kategori Tiket</legend>
        <div className="space-y-2">
          {categories.map((cat) => (
            <label
              key={cat.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                selectedId === cat.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <input
                type="radio"
                name="ticketCategory"
                value={cat.id}
                checked={selectedId === cat.id}
                onChange={() => onSelect(cat.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{cat.name}</div>
                <div className="text-sm text-muted-foreground">
                  Member: {formatIdr(cat.memberPrice)} · Reguler: {formatIdr(cat.regularPrice)}
                </div>
                {cat.maxQtyPerPerson && (
                  <div className="text-xs text-muted-foreground">
                    Maks {cat.maxQtyPerPerson} tiket/orang
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="text-sm font-medium">Jumlah Tiket</label>
        <select
          value={qty}
          onChange={(e) => onQtyChange(parseInt(e.target.value, 10))}
          className="mt-1 block w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
