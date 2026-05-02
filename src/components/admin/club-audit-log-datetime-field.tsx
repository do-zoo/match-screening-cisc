"use client";

import * as React from "react";

import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Label } from "@/components/ui/label";

function toPickerIso(raw: string, edge: "from" | "to"): string {
  const s = raw.trim();
  if (s === "") return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, d] = s.split("-").map((x) => Number.parseInt(x, 10));
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(mo) ||
      !Number.isFinite(d)
    ) {
      return "";
    }
    if (edge === "from") {
      return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0)).toISOString();
    }
    return new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999)).toISOString();
  }

  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}

export function ClubAuditLogDateTimeField(props: {
  id: string;
  name: "from" | "to";
  label: string;
  defaultValue: string;
}) {
  const edge = props.name === "from" ? "from" : "to";
  const [value, setValue] = React.useState(() =>
    toPickerIso(props.defaultValue, edge),
  );

  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      <input type="hidden" name={props.name} value={value} />
      <DateTimePicker
        id={props.id}
        value={value}
        onChange={(nextIso) => setValue(nextIso)}
        placeholder={
          edge === "from" ? "Mulai rentang…" : "Akhir rentang…"
        }
      />
    </div>
  );
}
