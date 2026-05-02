"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "__all__";

export function ClubAuditLogActionSelect(props: {
  id?: string;
  defaultAction: string;
  options: readonly string[];
}) {
  const [value, setValue] = React.useState(() =>
    props.defaultAction === "" ? ALL_VALUE : props.defaultAction,
  );

  const submitAction = value === ALL_VALUE ? "" : value;

  return (
    <>
      <input type="hidden" name="action" value={submitAction} />
      <Select
        value={value}
        onValueChange={(v) => {
          if (v !== null) setValue(v);
        }}
      >
        <SelectTrigger id={props.id} className="w-full">
          <SelectValue placeholder="Semua aksi" />
        </SelectTrigger>
        <SelectContent className="w-full">
          <SelectItem value={ALL_VALUE}>Semua aksi</SelectItem>
          {props.options.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
