import type { AppState } from "./types";
import { isValidTimezone } from "@/lib/time/timezone";

type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number, min = 0): value is string => typeof value === "string" && value.length >= min && value.length <= max;
const integer = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && (value as number) >= min;
const instant = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
const nullableInstant = (value: unknown): boolean => value === null || instant(value);
const localTime = (value: unknown): value is string => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const uniqueIds = (items: RecordValue[]): boolean => new Set(items.map((item) => item.id)).size === items.length;
const idsExist = (ids: unknown[], known: Set<unknown>): boolean => ids.every((id) => known.has(id));

/** Validate the whole persisted document before the UI can edit it. */
export function isAppState(value: unknown): value is AppState {
  if (!object(value) || value.schemaVersion !== 1 || !integer(value.documentRevision) || !integer(value.inputRevision) ||
      !["personal", "example"].includes(String(value.mode)) || typeof value.timezone !== "string" || !isValidTimezone(value.timezone) ||
      !nullableInstant(value.availabilityConfirmedAt) || !object(value.preferences) || !integer(value.preferences.sessionMinutes, 15) ||
      value.preferences.sessionMinutes % 15 !== 0 || !Array.isArray(value.assignments) || !Array.isArray(value.studyWindows) ||
      !Array.isArray(value.commitments) || !Array.isArray(value.workLogs)) return false;

  const assignments = value.assignments;
  if (!assignments.every(object) || !uniqueIds(assignments) || !assignments.every((item) =>
    text(item.id, 100, 1) && text(item.title, 120, 1) && item.title.trim() === item.title && text(item.course, 60) &&
    instant(item.dueAt) && integer(item.remainingMinutes) && ["active", "completed"].includes(String(item.status)) &&
    text(item.notes, 2000) && instant(item.createdAt) && instant(item.updatedAt) && nullableInstant(item.completedAt) &&
    (item.status === "active" ? item.remainingMinutes > 0 && item.completedAt === null : item.remainingMinutes === 0 && instant(item.completedAt)) &&
    (item.source === null || (object(item.source) && text(item.source.excerpt, 12000) &&
      (item.source.deadlineQuote === null || text(item.source.deadlineQuote, 12000)) &&
      (item.source.extractedDeadlineText === null || text(item.source.extractedDeadlineText, 1000)) &&
      nullableInstant(item.source.extractedDueAt) && instant(item.source.confirmedAt) && typeof item.source.editedByUser === "boolean"))
  )) return false;
  const assignmentIds = new Set(assignments.map((item) => item.id));

  const windows = value.studyWindows;
  if (!windows.every(object) || !uniqueIds(windows) || !windows.every((item) =>
    text(item.id, 100, 1) && integer(item.weekday, 1) && item.weekday <= 7 && localTime(item.localStart) &&
    (localTime(item.localEnd) || item.localEnd === "24:00") && item.localEnd > item.localStart && typeof item.enabled === "boolean")) return false;

  const commitments = value.commitments;
  if (!commitments.every(object) || !uniqueIds(commitments) || !commitments.every((item) =>
    text(item.id, 100, 1) && text(item.title, 120, 1) && instant(item.startAt) && instant(item.endAt) &&
    item.endAt > item.startAt && [null, "class", "work", "personal"].includes(item.category as null))) return false;

  const logs = value.workLogs;
  if (!logs.every(object) || !uniqueIds(logs) || new Set(logs.map((item) => item.focusId)).size !== logs.length || !logs.every((item) =>
    text(item.id, 100, 1) && text(item.focusId, 100, 1) && assignmentIds.has(item.assignmentId) &&
    integer(item.confirmedWorkedMinutes) && integer(item.remainingBefore) && integer(item.remainingAfter) &&
    typeof item.finishedAssignment === "boolean" && instant(item.savedAt))) return false;

  const plan = value.plan;
  let blocks: RecordValue[] = [];
  if (plan !== null) {
    if (!object(plan) || !instant(plan.generatedAt) || !integer(plan.inputRevision) || !instant(plan.horizonEndAt) ||
        !Array.isArray(plan.blocks) || !Array.isArray(plan.shortfalls) || !Array.isArray(plan.overdueAssignmentIds) ||
        !Array.isArray(plan.outsideHorizonIds) || !idsExist(plan.overdueAssignmentIds, assignmentIds) ||
        !idsExist(plan.outsideHorizonIds, assignmentIds)) return false;
    blocks = plan.blocks;
    if (!blocks.every(object) || !uniqueIds(blocks) || !blocks.every((item) =>
      text(item.id, 100, 1) && assignmentIds.has(item.assignmentId) && instant(item.startAt) && instant(item.endAt) &&
      item.endAt > item.startAt && ["scheduled", "active", "completed", "missed"].includes(String(item.state)) &&
      (item.state !== "scheduled" || plan.inputRevision !== value.inputRevision || (String(item.endAt) <= String(assignments.find((assignment) => assignment.id === item.assignmentId)?.dueAt) &&
        assignments.find((assignment) => assignment.id === item.assignmentId)?.status === "active")))) return false;
    if (!plan.shortfalls.every(object) || !plan.shortfalls.every((item) => assignmentIds.has(item.assignmentId) &&
      integer(item.requestedMinutes) && integer(item.allocatedMinutes) && integer(item.unscheduledMinutes) &&
      item.unscheduledMinutes === item.requestedMinutes - item.allocatedMinutes && item.reason === "insufficient_availability")) return false;
  }

  const focus = value.activeFocus;
  if (focus !== null && (!object(focus) || !text(focus.id, 100, 1) || !text(focus.blockId, 100, 1) ||
      !assignmentIds.has(focus.assignmentId) || !instant(focus.startedAt) || !nullableInstant(focus.lastResumedAt) ||
      !integer(focus.accumulatedSeconds) || !["running", "paused", "review"].includes(String(focus.state)) ||
      (focus.state === "running") !== instant(focus.lastResumedAt) ||
      !blocks.some((block) => block.id === focus.blockId && block.assignmentId === focus.assignmentId && block.state === "active") ||
      logs.some((log) => log.focusId === focus.id))) return false;
  if (focus === null && blocks.some((block) => block.state === "active")) return false;

  return true;
}
