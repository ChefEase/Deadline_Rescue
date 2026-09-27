import type { Commitment, StudyWindow } from "@/lib/schema/types";
import { localDateTimeToInstant } from "@/lib/time/timezone";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** A time input returns 00:00 for midnight; persist it as the end of this day. */
export function normalizeStudyWindowEnd(value: string): string {
  return value === "00:00" ? "24:00" : value;
}

export function displayStudyWindowEnd(value: string): string {
  return value === "24:00" ? "00:00" : value;
}

/** Suggested hours stay as a draft until the user reviews and confirms them. */
export function proposedStudyWindows(): StudyWindow[] {
  return WEEKDAYS.map((_, index) => ({
    id: crypto.randomUUID(),
    weekday: (index + 1) as StudyWindow["weekday"],
    localStart: index < 5 ? "16:00" : "10:00",
    localEnd: index < 5 ? "22:00" : "18:00",
    enabled: true,
  }));
}

export function validateWindows(windows: StudyWindow[]): string | null {
  if (!windows.some((window) => window.enabled)) return "Enable at least one study window.";
  for (const window of windows) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(window.localStart) ||
        !(/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(window.localEnd) || window.localEnd === "24:00") ||
        window.localEnd <= window.localStart) {
      return `${WEEKDAYS[window.weekday - 1]} needs an end time later on the same day. For study past midnight, add another window on the next day.`;
    }
  }
  return null;
}

export interface CommitmentInput {
  title: string;
  date: string;
  start: string;
  end: string;
  category: Commitment["category"];
}

function nextLocalDate(date: string): string | null {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return Number.isNaN(next.getTime()) ? null : next.toISOString().slice(0, 10);
}

/** One overnight entry becomes two dated records, split at local midnight. */
export function buildCommitments(input: CommitmentInput, timezone: string): Commitment[] | null {
  const title = input.title.trim();
  if (!title || title.length > 120 || input.end === input.start) return null;
  const startAt = localDateTimeToInstant(input.date, input.start, timezone);
  if (!startAt) return null;

  const overnight = input.end < input.start;
  const endDate = overnight ? nextLocalDate(input.date) : input.date;
  const endAt = endDate && localDateTimeToInstant(endDate, input.end, timezone);
  if (!endAt || endAt <= startAt) return null;

  const make = (from: string, to: string): Commitment => ({
    id: crypto.randomUUID(), title, startAt: from, endAt: to, category: input.category,
  });
  if (!overnight) return [make(startAt, endAt)];
  if (input.end === "00:00") return [make(startAt, endAt)];

  const midnight = localDateTimeToInstant(endDate, "00:00", timezone);
  if (!midnight || midnight <= startAt || midnight >= endAt) return null;
  return [make(startAt, midnight), make(midnight, endAt)];
}
