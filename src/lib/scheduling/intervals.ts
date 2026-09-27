import type { Commitment, Instant } from "@/lib/schema/types";

export interface Interval {
  startAt: Instant;
  endAt: Instant;
}

/** Scheduling subtracts this union, while the UI keeps each labelled commitment. */
export function mergeCommitmentIntervals(commitments: Commitment[]): Interval[] {
  const intervals = commitments
    .map(({ startAt, endAt }) => ({ startAt, endAt }))
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.endAt.localeCompare(b.endAt));
  const merged: Interval[] = [];

  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (last && interval.startAt <= last.endAt) {
      if (interval.endAt > last.endAt) last.endAt = interval.endAt;
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}
