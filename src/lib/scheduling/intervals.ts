import type { Commitment, Instant } from "../schema/types";

export interface Interval {
  startAt: Instant;
  endAt: Instant;
}

/** Merge overlapping or adjacent half-open intervals without changing their inputs. */
export function mergeIntervals(input: Interval[]): Interval[] {
  const intervals = input
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

/** Scheduling subtracts this union, while the UI keeps each labelled commitment. */
export function mergeCommitmentIntervals(commitments: Commitment[]): Interval[] {
  return mergeIntervals(commitments);
}

export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

/** Subtract blocked intervals from available time using half-open boundaries. */
export function subtractIntervals(available: Interval[], blocked: Interval[]): Interval[] {
  const free: Interval[] = [];
  const union = mergeIntervals(blocked);

  for (const window of mergeIntervals(available)) {
    let cursor = window.startAt;
    for (const block of union) {
      if (block.endAt <= cursor) continue;
      if (block.startAt >= window.endAt) break;
      if (block.startAt > cursor) free.push({ startAt: cursor, endAt: block.startAt });
      if (block.endAt > cursor) cursor = block.endAt;
      if (cursor >= window.endAt) break;
    }
    if (cursor < window.endAt) free.push({ startAt: cursor, endAt: window.endAt });
  }
  return free;
}
