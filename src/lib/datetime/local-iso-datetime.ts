import { setHours, setMinutes, startOfDay } from "date-fns";

/** Parse ISO; derive local-calendar midnight + HH:mm untuk editor. */
export function isoStringToCalendarAndTime(
  iso: string,
): { day: Date; hhmm: string } | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const day = startOfDay(d);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return { day, hhmm: `${hh}:${mm}` };
}

const HH_MM = /^(\d{1,2}):(\d{2})$/;

/** Bangun UTC ISO dari hari kalender (lokal) + waktu HH:mm (lokal). */
export function calendarDayAndTimeToIso(
  day: Date,
  hhmm: string,
): string | null {
  const m = hhmm.trim().match(HH_MM);
  if (!m) return null;
  const h = Number(m[1]);
  const mins = Number(m[2]);
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  if (!Number.isInteger(mins) || mins < 0 || mins > 59) return null;
  const atDay = startOfDay(day);
  const withClock = setMinutes(setHours(atDay, h), mins);
  return withClock.toISOString();
}
