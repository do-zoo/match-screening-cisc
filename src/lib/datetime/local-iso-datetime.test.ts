import { describe, expect, it } from "vitest";
import {
  calendarDayAndTimeToIso,
  isoStringToCalendarAndTime,
} from "./local-iso-datetime";

describe("isoStringToCalendarAndTime", () => {
  it("returns local calendar day and HH:mm for a valid ISO string", () => {
    const iso = "2026-07-04T06:30:00.000Z";
    const got = isoStringToCalendarAndTime(iso);
    expect(got).not.toBeNull();
    expect(got!.hhmm).toMatch(/^\d{2}:\d{2}$/);
    const roundTrip = calendarDayAndTimeToIso(got!.day, got!.hhmm);
    expect(roundTrip).not.toBeNull();
    expect(new Date(roundTrip!).getTime()).toBe(new Date(iso).getTime());
  });

  it("returns null for non-parseable string", () => {
    expect(isoStringToCalendarAndTime("")).toBeNull();
    expect(isoStringToCalendarAndTime("bukan-waktu")).toBeNull();
  });
});

describe("calendarDayAndTimeToIso", () => {
  it("returns null for invalid time token", () => {
    expect(calendarDayAndTimeToIso(new Date(), "99:qq")).toBeNull();
  });
});
