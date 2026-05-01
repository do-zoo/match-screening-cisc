"use client";

import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  calendarDayAndTimeToIso,
  isoStringToCalendarAndTime,
} from "@/lib/datetime/local-iso-datetime";

export type DateTimePickerProps = {
  value: string;
  onChange: (nextIso: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  placeholder?: string;
};

export function DateTimePicker({
  value,
  onChange,
  disabled,
  id,
  "aria-invalid": ariaInvalid,
  placeholder = "Pilih tanggal & waktu",
}: DateTimePickerProps) {
  const parts = isoStringToCalendarAndTime(value);
  const selectedDay = parts?.day ?? undefined;
  const timeStr = parts?.hhmm ?? "09:00";

  function applyNewDay(day: Date | undefined) {
    if (!day) return;
    const iso = calendarDayAndTimeToIso(day, timeStr);
    if (iso) onChange(iso);
  }

  function applyNewTime(nextHhmm: string) {
    if (!selectedDay) return;
    const iso = calendarDayAndTimeToIso(selectedDay, nextHhmm);
    if (iso) onChange(iso);
  }

  const label = parts
    ? format(new Date(value), "d MMMM yyyy, HH:mm", { locale: localeId })
    : placeholder;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Popover>
        <PopoverTrigger
          disabled={disabled}
          id={id}
          aria-invalid={ariaInvalid ?? false}
          render={
            <Button
              variant="outline"
              className="w-full justify-start font-normal sm:flex-1"
            />
          }
        >
          <CalendarIcon className="mr-2 size-4 shrink-0" />
          <span className={cn(!parts && "text-muted-foreground")}>{label}</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            locale={localeId}
            captionLayout="dropdown"
            selected={selectedDay}
            onSelect={(d) => applyNewDay(d)}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        step={60}
        disabled={disabled || !selectedDay}
        aria-invalid={ariaInvalid}
        value={selectedDay ? timeStr : ""}
        onChange={(e) => applyNewTime(e.target.value)}
        className="bg-background sm:w-[8.5rem]"
      />
    </div>
  );
}
