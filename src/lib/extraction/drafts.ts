import type { Assignment, AssignmentSource } from "../schema/types";
import { isValidTimezone, localDateTimeToInstant } from "../time/timezone";

export interface ExtractionRequest {
  text: string;
  timezone: string;
  referenceDate: string;
}

export interface ExtractedDraft {
  title: string;
  course: string;
  date: string;
  time: string;
  deadlineText: string;
  deadlineQuote: string | null;
  excerpt: string;
  warnings: string[];
}

export interface ExtractionResult {
  drafts: ExtractedDraft[];
  limitWarning: boolean;
}

export interface ReviewDraft extends ExtractedDraft {
  id: string;
  originalDate: string;
  originalTime: string;
  hours: string;
  minutes: string;
  confirmed: boolean;
  skipped: boolean;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function boundedText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Validate the small browser request before it can reach the provider. */
export function parseExtractionRequest(value: unknown): ExtractionRequest | null {
  const input = record(value);
  if (!input || typeof input.text !== "string" || !input.text.trim() || input.text.length > 12_000 ||
      typeof input.timezone !== "string" || !isValidTimezone(input.timezone) ||
      typeof input.referenceDate !== "string" || !datePattern.test(input.referenceDate) ||
      !Number.isFinite(Date.parse(`${input.referenceDate}T12:00:00Z`))) return null;
  return { text: input.text, timezone: input.timezone, referenceDate: input.referenceDate };
}

/** Model output is untrusted: keep only bounded fields and verify every claimed quote. */
export function parseModelDrafts(output: string, sourceText: string): ExtractionResult {
  const raw = output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const payload = record(JSON.parse(raw));
  if (!payload || !Array.isArray(payload.assignments) || payload.assignments.length > 50) throw new Error("invalid_model_response");
  const drafts: ExtractedDraft[] = payload.assignments.slice(0, 10).map((item: unknown) => {
    const entry = record(item);
    if (!entry || typeof entry.title !== "string" || !entry.title.trim()) throw new Error("invalid_model_response");
    const warnings = Array.isArray(entry.warnings)
      ? entry.warnings.filter((warning): warning is string => typeof warning === "string").slice(0, 4).map((warning: string) => warning.slice(0, 180))
      : [];
    const proposedQuote = boundedText(entry.deadlineQuote, 500);
    const deadlineQuote = proposedQuote && sourceText.includes(proposedQuote) ? proposedQuote : null;
    const proposedExcerpt = boundedText(entry.excerpt, 700);
    const excerpt = proposedExcerpt && sourceText.includes(proposedExcerpt) ? proposedExcerpt : "";
    if (proposedQuote && !deadlineQuote) warnings.push("The suggested deadline quote could not be verified in your text.");
    if (!deadlineQuote) warnings.push("Check the deadline against your original text.");
    const date = boundedText(entry.date, 10);
    const time = boundedText(entry.time, 5);
    if (date && !datePattern.test(date)) warnings.push("Choose the due date yourself.");
    if (time && !timePattern.test(time)) warnings.push("Choose the due time yourself.");
    return {
      title: boundedText(entry.title, 120), course: boundedText(entry.course, 60),
      date: datePattern.test(date) ? date : "", time: timePattern.test(time) ? time : "",
      deadlineText: boundedText(entry.deadlineText, 300), deadlineQuote, excerpt,
      warnings,
    };
  });
  return { drafts, limitWarning: payload.assignments.length > 10 || payload.moreThanTen === true };
}

export function duplicateAssignment(title: string, dueAt: string, existing: Assignment[]): boolean {
  const normalized = title.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return existing.some((assignment) => assignment.title.trim().replace(/\s+/g, " ").toLocaleLowerCase() === normalized && assignment.dueAt === dueAt);
}

/** A reviewed draft becomes persisted data only after an explicit confirmation. */
export function confirmedAssignment(draft: ReviewDraft, timezone: string, now: string, id: string): Assignment {
  if (!draft.confirmed || draft.skipped) throw new Error("Confirm this assignment before saving.");
  const title = draft.title.trim();
  const course = draft.course.trim();
  const dueAt = localDateTimeToInstant(draft.date, draft.time, timezone);
  const hours = Number(draft.hours);
  const minutes = Number(draft.minutes);
  const remainingMinutes = hours * 60 + minutes;
  if (!title || title.length > 120 || course.length > 60 || !dueAt ||
      !/^\d+$/.test(draft.hours) || !/^\d+$/.test(draft.minutes) ||
      !Number.isSafeInteger(hours) || !Number.isSafeInteger(minutes) ||
      hours > 10_000 || minutes > 59 || remainingMinutes < 1 || !Number.isSafeInteger(remainingMinutes)) {
    throw new Error("Add a valid title, deadline, and remaining work estimate.");
  }
  const extractedDueAt = draft.originalDate && draft.originalTime
    ? localDateTimeToInstant(draft.originalDate, draft.originalTime, timezone) : null;
  const source: AssignmentSource = {
    excerpt: draft.excerpt, deadlineQuote: draft.deadlineQuote,
    extractedDeadlineText: draft.deadlineText || null, extractedDueAt,
    confirmedAt: now, editedByUser: extractedDueAt !== null && extractedDueAt !== dueAt,
  };
  return { id, title, course, dueAt, remainingMinutes, status: "active", notes: "", source, createdAt: now, updatedAt: now, completedAt: null };
}
