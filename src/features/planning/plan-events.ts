import type { AppState, Assignment, Commitment, StudyBlock } from "@/lib/schema/types";
import { subtractIntervals } from "@/lib/scheduling/intervals";
import { localDayStart } from "@/lib/scheduling/scheduler";
import { addLocalDays, localDateTimeCandidates } from "@/lib/time/timezone";

export type PlanEvent =
  | { kind: "session"; startAt: string; endAt: string; block: StudyBlock; assignment: Assignment }
  | { kind: "commitment"; startAt: string; endAt: string; commitment: Commitment }
  | { kind: "availability"; startAt: string; endAt: string };

/** Show planned work and genuinely free study hours for one local calendar day. */
export function eventsForDate(state: AppState, date: string): PlanEvent[] {
  // Local day boundaries keep sessions and commitments visible when they cross midnight.
  const dayStart = localDayStart(date, state.timezone);
  const nextDayStart = localDayStart(addLocalDays(date, 1), state.timezone);
  const overlapsDay = (startAt: string, endAt: string) => startAt < nextDayStart && endAt > dayStart;
  const assignments = new Map(state.assignments.map((assignment) => [assignment.id, assignment]));
  const sessions: PlanEvent[] = (state.plan?.blocks ?? []).flatMap((block) => {
    const assignment = assignments.get(block.assignmentId);
    return assignment && overlapsDay(block.startAt, block.endAt)
      ? [{ kind: "session" as const, startAt: block.startAt, endAt: block.endAt, block, assignment }]
      : [];
  });
  const commitments: PlanEvent[] = state.commitments
    .filter((commitment) => overlapsDay(commitment.startAt, commitment.endAt))
    .map((commitment) => ({ kind: "commitment", startAt: commitment.startAt, endAt: commitment.endAt, commitment }));

  const weekday = ((new Date(`${date}T00:00:00.000Z`).getUTCDay() + 6) % 7) + 1;
  const studyHours = state.studyWindows.flatMap((window) => {
    if (!window.enabled || window.weekday !== weekday) return [];
    const startAt = localDateTimeCandidates(date, window.localStart, state.timezone)[0];
    const endDate = window.localEnd === "24:00" ? addLocalDays(date, 1) : date;
    const endTime = window.localEnd === "24:00" ? "00:00" : window.localEnd;
    const endAt = localDateTimeCandidates(endDate, endTime, state.timezone)[0];
    return startAt && endAt && endAt > startAt ? [{ startAt, endAt }] : [];
  });
  // Commitments take priority; scheduled sessions remain visible inside the free window.
  const availability: PlanEvent[] = subtractIntervals(studyHours, state.commitments)
    .map(({ startAt, endAt }) => ({ kind: "availability", startAt, endAt }));
  return [...sessions, ...commitments, ...availability]
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.kind.localeCompare(b.kind));
}
