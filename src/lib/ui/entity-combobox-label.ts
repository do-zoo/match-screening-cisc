export type EntityComboboxOptionRow = {
  value: string;
  label: string;
  keywords?: string;
};

export function labelForOptionValue(
  options: readonly EntityComboboxOptionRow[],
  value: string | null,
): string | null {
  if (value === null) return null;
  const hit = options.find((o) => o.value === value);
  return hit?.label ?? null;
}
