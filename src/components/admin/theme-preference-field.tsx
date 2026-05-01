"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
  { value: "system", label: "Ikuti sistem" },
] as const;

const emptySubscribe = () => () => {};

function useClientMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export function ThemePreferenceField() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useClientMounted();

  const current =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system";

  const activeLabel =
    resolvedTheme === "dark" ? "gelap" : resolvedTheme === "light" ? "terang" : "";

  return (
    <div className="flex flex-col gap-2">
      <Label>Tampilan</Label>
      {!mounted ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : (
        <>
          <RadioGroup
            className="flex flex-col gap-3"
            value={current}
            onValueChange={(val) => {
              if (val === "light" || val === "dark" || val === "system") {
                setTheme(val);
              }
            }}
          >
            {OPTIONS.map((o) => (
              <Label
                key={o.value}
                htmlFor={`theme-${o.value}`}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-2 text-sm has-data-checked:border-primary has-data-checked:bg-primary/5",
                )}
              >
                <RadioGroupItem value={o.value} id={`theme-${o.value}`} />
                <span>{o.label}</span>
              </Label>
            ))}
          </RadioGroup>
          {activeLabel ? (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Aktif: {activeLabel}
              {current === "system" ? " (mengikuti sistem)" : ""}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
