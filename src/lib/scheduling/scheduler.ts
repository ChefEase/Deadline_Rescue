import type {
  ActiveFocus, Assignment, Commitment, Plan, StudyBlock, StudyWindow,
} from "../schema/types";
import {
  addLocalDays, instantToLocalFields, isValidTimezone, localDateTimeCandidates,
} from "../time/timezone";
import {
  intervalsOverlap, mergeCommitmentIntervals, mergeIntervals, subtractIntervals, type Interval,
} from "./intervals";

const GRID_MINUTES = 15;
const GRID_MS = GRID_MINUTES * 60_000;
const HORIZON_DAYS = 14;

export interface SchedulerInput {
  now: string;
  timezone: string;
  sessionMinutes: number;
  inputRevision: number;
  assignments: Assignment[];
  studyWindows: StudyWindow[];
  commitments: Commitment[];
  activeFocus: ActiveFocus | null;
  previousPlan: Plan | null;
}

export class SchedulingError extends Error {
  constructor(public readonly code: "invalid_input" | "active_focus_conflict" | "invalid_plan", message: string) {
    super(message);
    this.name = "SchedulingError";
  }
}

function toIso(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

function roundUp(milliseconds: number): number {
  return Math.ceil(milliseconds / GRID_MS) * GRID_MS;
}

function roundDown(milliseconds: number): number {
  return Math.floor(milliseconds / GRID_MS) * GRID_MS;
}

function localDayStart(date: string, timezone: string): string {
  // Some zones skip midnight during a clock change; use the first valid quarter hour.
  for (let minute = 0; minute <= 180; minute += GRID_MINUTES) {
    const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const candidate = localDateTimeCandidates(date, time, timezone)[0];
    if (candidate) return candidate;
  }
  throw new SchedulingError("invalid_input", `No valid start of day for ${date} in ${timezone}.`);
}

function expandStudyWindows(input: SchedulerInput, localToday: string): Interval[] {
  const expanded: Interval[] = [];
  for (let day = 0; day < HORIZON_DAYS; day++) {
    const date = addLocalDays(localToday, day);
    const weekday = ((new Date(`${date}T00:00:00.000Z`).getUTCDay() + 6) % 7) + 1;
    for (const window of input.studyWindows) {
      if (!window.enabled || window.weekday !== weekday) continue;
      const startAt = localDateTimeCandidates(date, window.localStart, input.timezone)[0];
      const endDate = window.localEnd === "24:00" ? addLocalDays(date, 1) : date;
      const endTime = window.localEnd === "24:00" ? "00:00" : window.localEnd;
      const endAt = localDateTimeCandidates(endDate, endTime, input.timezone)[0];
      // Skip nonexistent local endpoints rather than inventing availability.
      if (startAt && endAt && endAt > startAt) expanded.push({ startAt, endAt });
    }
  }
  return mergeIntervals(expanded);
}

function clipAndRound(intervals: Interval[], nowMs: number, horizonMs: number): Interval[] {
  const rounded: Interval[] = [];
  for (const interval of intervals) {
    const start = roundUp(Math.max(nowMs, Date.parse(interval.startAt)));
    const end = roundDown(Math.min(horizonMs, Date.parse(interval.endAt)));
    if (start < end) rounded.push({ startAt: toIso(start), endAt: toIso(end) });
  }
  return mergeIntervals(rounded);
}

function assignmentOrder(a: Assignment, b: Assignment): number {
  return a.dueAt.localeCompare(b.dueAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function groupSlots(assignmentId: string, slots: number[], sessionMinutes: number): StudyBlock[] {
  if (slots.length === 0) return [];
  const blocks: StudyBlock[] = [];
  const maxSlots = sessionMinutes / GRID_MINUTES;
  let start = slots[0];
  let previous = slots[0];
  let count = 1;

  function flush() {
    const startAt = toIso(start);
    blocks.push({
      id: `study:${assignmentId.slice(0, 40)}:${startAt}`,
      assignmentId,
      startAt,
      endAt: toIso(previous + GRID_MS),
      state: "scheduled",
    });
  }

  for (const slot of slots.slice(1)) {
    if (slot === previous + GRID_MS && count < maxSlots) {
      previous = slot;
      count++;
    } else {
      flush();
      start = slot;
      previous = slot;
      count = 1;
    }
  }
  flush();
  return blocks;
}

function validateNewBlocks(
  blocks: StudyBlock[], assignments: Assignment[], availability: Interval[], commitments: Interval[],
  now: string, horizonEndAt: string, sessionMinutes: number,
) {
  const byId = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const ordered = [...blocks].sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id));
  for (let index = 0; index < ordered.length; index++) {
    const block = ordered[index];
    const assignment = byId.get(block.assignmentId);
    const minutes = (Date.parse(block.endAt) - Date.parse(block.startAt)) / 60_000;
    if (!assignment || assignment.status !== "active" || block.startAt < now || block.endAt > horizonEndAt ||
        block.endAt > assignment.dueAt || minutes < GRID_MINUTES || minutes > sessionMinutes ||
        minutes % GRID_MINUTES !== 0 || (index > 0 && ordered[index - 1].endAt > block.startAt) ||
        !availability.some((window) => window.startAt <= block.startAt && block.endAt <= window.endAt) ||
        commitments.some((commitment) => intervalsOverlap(block, commitment))) {
      throw new SchedulingError("invalid_plan", "A generated session violates a scheduling constraint.");
    }
  }
}

/** Build the same plan for the same confirmed inputs and reference instant. */
export function buildSchedule(input: SchedulerInput): Plan {
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs) || new Date(nowMs).toISOString() !== input.now ||
      !isValidTimezone(input.timezone) || !Number.isSafeInteger(input.sessionMinutes) ||
      input.sessionMinutes < GRID_MINUTES || input.sessionMinutes % GRID_MINUTES !== 0 ||
      !Number.isSafeInteger(input.inputRevision) || input.inputRevision < 0) {
    throw new SchedulingError("invalid_input", "The scheduler received invalid inputs.");
  }

  const localToday = instantToLocalFields(input.now, input.timezone).date;
  const horizonEndAt = localDayStart(addLocalDays(localToday, HORIZON_DAYS), input.timezone);
  const horizonMs = Date.parse(horizonEndAt);
  const allAvailability = expandStudyWindows(input, localToday);
  const clippedAvailability = clipAndRound(allAvailability, nowMs, horizonMs);
  const blocked = mergeCommitmentIntervals(input.commitments);

  const previousBlocks = input.previousPlan?.blocks ?? [];
  const activeBlock = input.activeFocus
    ? previousBlocks.find((block) => block.id === input.activeFocus?.blockId) : undefined;
  if (input.activeFocus && (!activeBlock || activeBlock.assignmentId !== input.activeFocus.assignmentId)) {
    throw new SchedulingError("invalid_input", "The active Focus session has no matching saved block.");
  }
  if (activeBlock && blocked.some((interval) => intervalsOverlap(activeBlock, interval))) {
    throw new SchedulingError("active_focus_conflict", "A commitment overlaps the active Focus session.");
  }

  const protectedBlocks = previousBlocks.filter((block) =>
    block.id !== activeBlock?.id && (block.state === "completed" || block.state === "missed"));
  if (activeBlock) protectedBlocks.push({ ...activeBlock, state: "active" });
  const reserved = activeBlock ? [{ startAt: activeBlock.startAt, endAt: activeBlock.endAt }] : [];
  const freeIntervals = clipAndRound(subtractIntervals(clippedAvailability, [...blocked, ...reserved]), nowMs, horizonMs);

  const slots: number[] = [];
  for (const interval of freeIntervals) {
    for (let start = Date.parse(interval.startAt); start + GRID_MS <= Date.parse(interval.endAt); start += GRID_MS) {
      slots.push(start);
    }
  }
  const used = new Set<number>();
  const active = input.assignments.filter((assignment) => assignment.status === "active").sort(assignmentOrder);
  const overdue = active.filter((assignment) => assignment.dueAt <= input.now);
  const outside = active.filter((assignment) => assignment.dueAt >= horizonEndAt);
  const eligible = active.filter((assignment) => assignment.dueAt > input.now && assignment.dueAt < horizonEndAt);
  const newBlocks: StudyBlock[] = [];
  const shortfalls: Plan["shortfalls"] = [];

  for (const assignment of eligible) {
    const requestedMinutes = Math.ceil(assignment.remainingMinutes / GRID_MINUTES) * GRID_MINUTES;
    const reservedMinutes = activeBlock?.assignmentId === assignment.id
      ? Math.max(0, (Date.parse(activeBlock.endAt) - Date.parse(activeBlock.startAt)) / 60_000) : 0;
    const neededSlots = Math.ceil(Math.max(0, requestedMinutes - reservedMinutes) / GRID_MINUTES);
    const chosen: number[] = [];

    for (const slot of slots) {
      if (chosen.length === neededSlots) break;
      if (!used.has(slot) && slot + GRID_MS <= Date.parse(assignment.dueAt)) {
        used.add(slot);
        chosen.push(slot);
      }
    }
    newBlocks.push(...groupSlots(assignment.id, chosen, input.sessionMinutes));
    const allocatedMinutes = Math.min(requestedMinutes, reservedMinutes) + chosen.length * GRID_MINUTES;
    if (allocatedMinutes < requestedMinutes) {
      shortfalls.push({
        assignmentId: assignment.id,
        requestedMinutes,
        allocatedMinutes,
        unscheduledMinutes: requestedMinutes - allocatedMinutes,
        reason: "insufficient_availability",
      });
    }
  }

  validateNewBlocks(newBlocks, input.assignments, clippedAvailability, blocked, input.now, horizonEndAt, input.sessionMinutes);
  const allBlocks = [...protectedBlocks, ...newBlocks].sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id));
  return {
    generatedAt: input.now,
    inputRevision: input.inputRevision,
    horizonEndAt,
    blocks: allBlocks,
    shortfalls,
    overdueAssignmentIds: overdue.map((assignment) => assignment.id),
    outsideHorizonIds: outside.map((assignment) => assignment.id),
  };
}
