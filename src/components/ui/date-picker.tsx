"use client";

import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Matcher } from "react-day-picker";

function parseNaiveYYYYMMDD(s: string): Date | undefined {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined;
  const [y, m, d] = t.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  )
    return undefined;
  return date;
}

function formatNaiveYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export type DatePickerProps = {
  value: string;
  onChange: (nextYyyyMmDd: string) => void;
  onBlur?: () => void;
  disabledModifiers?: Matcher | Matcher[] | undefined;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  placeholder?: string;
  startMonth?: Date;
  endMonth?: Date;
};

export function DatePicker({
  value,
  onChange,
  onBlur,
  disabled,
  disabledModifiers,
  id,
  "aria-invalid": ariaInvalid,
  placeholder = "Pilih tanggal",
  startMonth,
  endMonth,
}: DatePickerProps) {
  const selectedDay = parseNaiveYYYYMMDD(value);

  const label = selectedDay
    ? format(selectedDay, "d MMMM yyyy", { locale: localeId })
    : placeholder;

  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        id={id}
        aria-invalid={ariaInvalid ?? false}
        onBlur={onBlur}
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start font-normal"
          />
        }
      >
        <CalendarIcon className="mr-2 size-4 shrink-0" />
        <span className={cn(!selectedDay && "text-muted-foreground")}>
          {label}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          locale={localeId}
          captionLayout="dropdown"
          selected={selectedDay}
          onSelect={(d) => {
            if (d) onChange(formatNaiveYYYYMMDD(d));
          }}
          disabled={disabledModifiers}
          startMonth={startMonth}
          endMonth={endMonth}
        />
      </PopoverContent>
    </Popover>
  );
}
