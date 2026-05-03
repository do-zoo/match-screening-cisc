"use client";

import * as React from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  labelForOptionValue,
  type EntityComboboxOptionRow,
} from "@/lib/ui/entity-combobox-label";

function matchQuery(row: EntityComboboxOptionRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (needle === "") return true;
  const hay = `${row.label} ${row.keywords ?? ""}`.toLowerCase();
  return hay.includes(needle);
}

export type EntityComboboxProps = {
  id?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /** null = belum memilih; jangan gunakan "" untuk nilai eksplisit */
  value: string | null;
  onValueChange: (next: string | null) => void;
  options: readonly EntityComboboxOptionRow[];
  "aria-invalid"?: boolean;
};

export function EntityCombobox({
  id,
  className,
  disabled,
  placeholder = "Pilih…",
  value,
  onValueChange,
  options,
  "aria-invalid": ariaInvalid,
}: EntityComboboxProps) {
  const items = React.useMemo(() => options.map((o) => o.value), [options]);

  const itemToStringLabel = React.useCallback(
    (v: unknown) => {
      const s = typeof v === "string" ? v : null;
      return labelForOptionValue(options, s) ?? "";
    },
    [options],
  );

  const filter = React.useCallback(
    (itemValue: unknown, query: string) => {
      const key = typeof itemValue === "string" ? itemValue : null;
      if (key === null) return false;
      const row = options.find((o) => o.value === key);
      if (!row) return false;
      return matchQuery(row, query);
    },
    [options],
  );

  return (
    <div className={cn("w-full", className)}>
    <Combobox
      value={value}
      disabled={disabled}
      items={items}
      itemToStringLabel={itemToStringLabel}
      filter={filter}
      onValueChange={(next) => {
        onValueChange(next == null ? null : String(next));
      }}
      modal={false}
    >
      <ComboboxInput
        id={id}
        showClear={false}
        disabled={disabled}
        className="w-full"
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
      />
      <ComboboxContent sideOffset={6} align="start" className="min-w-(--anchor-width)">
        <ComboboxList>
          {(itemValue: unknown) => {
            const vid = typeof itemValue === "string" ? itemValue : null;
            if (vid === null) return null;
            const row = options.find((o) => o.value === vid);
            if (!row) return null;
            return (
              <ComboboxItem key={vid} value={vid}>
                {row.label}
              </ComboboxItem>
            );
          }}
        </ComboboxList>
        <ComboboxEmpty>Tidak ada hasil.</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
    </div>
  );
}
