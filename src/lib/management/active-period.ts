export type BoardPeriodRow = {
  id: string;
  startsAt: Date;
  endsAt: Date;
};

/** Active iff startsAt <= now < endsAt (UTC instants). */
export function findActiveBoardPeriod(
  periods: BoardPeriodRow[],
  now: Date,
): BoardPeriodRow | null {
  return periods.find((p) => p.startsAt <= now && now < p.endsAt) ?? null;
}

export function periodsOverlap(
  a: { startsAt: Date; endsAt: Date },
  b: { startsAt: Date; endsAt: Date },
): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}
