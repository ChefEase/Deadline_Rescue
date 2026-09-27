import type { AppState, Assignment, Commitment, StudyWindow } from "../schema/types";
import { schedulingInputsChanged } from "../scheduling/input-revision";
import { buildSchedule } from "../scheduling/scheduler";
import { addLocalDays, instantToLocalFields, localDateTimeToInstant } from "../time/timezone";

export const EXAMPLE_SHIFT_ID = "example:work-shift";
export const EXAMPLE_RECOVERY_ID = "example:recovery-window";

function weekday(date: string): StudyWindow["weekday"] {
  return (((new Date(`${date}T12:00:00.000Z`).getUTCDay() + 6) % 7) + 1) as StudyWindow["weekday"];
}

function window(id: string, date: string, start: string, end: string, enabled = true): StudyWindow {
  return { id, weekday: weekday(date), localStart: start, localEnd: end, enabled };
}

function dueAt(date: string, timezone: string): string {
  const instant = localDateTimeToInstant(date, "20:00", timezone);
  if (!instant) throw new Error("The example could not find a valid local deadline.");
  return instant;
}

/** Create a fresh, clearly synthetic scenario around the student's local day. */
export function createExampleState(previous: AppState, now: string): AppState {
  const timezone = previous.timezone;
  const today = instantToLocalFields(now, timezone).date;
  const tomorrow = addLocalDays(today, 1);
  const repairDay = addLocalDays(today, 2);
  const nowMs = Date.parse(now);
  const quarterMs = 15 * 60_000;
  const firstStartMs = Math.floor(nowMs / quarterMs) * quarterMs;
  const firstStart = instantToLocalFields(new Date(firstStartMs).toISOString(), timezone);
  const firstEnd = instantToLocalFields(new Date(firstStartMs + 60 * 60_000).toISOString(), timezone);
  const nextHour = Number(firstStart.time.slice(0, 2)) + 1;
  const afterRepeatedHour = nextHour === 24 ? "24:00" : `${String(nextHour).padStart(2, "0")}:00`;

  // Leave a small buffer so a real few-minute walkthrough can Replan without losing the fit.
  const immediateWindows: StudyWindow[] = firstStart.date === firstEnd.date && firstEnd.time > firstStart.time
    ? [window("example:now", firstStart.date, firstStart.time, firstEnd.time)]
    : firstStart.date === firstEnd.date
      ? [window("example:now", firstStart.date, firstStart.time, afterRepeatedHour)]
    : firstEnd.date === addLocalDays(firstStart.date, 1)
      ? [window("example:now", firstStart.date, firstStart.time, "24:00"),
          ...(firstEnd.time === "00:00" ? [] : [window("example:after-midnight", firstEnd.date, "00:00", firstEnd.time)])]
      : [window("example:now", today, "03:00", "04:00")];

  const studyWindows = [
    ...immediateWindows,
    window("example:main-window", tomorrow, "16:00", "20:00"),
    window(EXAMPLE_RECOVERY_ID, repairDay, "16:00", "18:00", false),
  ];
  const assignment = (id: string, title: string, course: string, date: string, remainingMinutes: number): Assignment => ({
    id, title, course, dueAt: dueAt(date, timezone), remainingMinutes,
    status: "active", notes: "Synthetic example for trying the planner.", source: null,
    createdAt: now, updatedAt: now, completedAt: null,
  });
  const assignments = [
    assignment("example:programming", "Programming project", "Computer science", tomorrow, 150),
    assignment("example:maths", "Maths review", "Maths", repairDay, 120),
  ];
  const classStart = localDateTimeToInstant(tomorrow, "12:00", timezone);
  const classEnd = localDateTimeToInstant(tomorrow, "13:00", timezone);
  if (!classStart || !classEnd) throw new Error("The example could not place its sample class.");
  const commitments: Commitment[] = [{
    id: "example:class", title: "Sample class", category: "class", startAt: classStart, endAt: classEnd,
  }];
  const draft: AppState = {
    ...previous, mode: "example", availabilityConfirmedAt: now,
    preferences: { sessionMinutes: 30 }, assignments, studyWindows, commitments,
    plan: null, activeFocus: null, workLogs: [],
  };
  const inputRevision = previous.inputRevision + (schedulingInputsChanged(previous, draft) ? 1 : 0);
  // Start at the preceding quarter hour so the first session can be opened immediately.
  const referenceNow = new Date(firstStartMs - 1).toISOString();
  const plan = buildSchedule({ now: referenceNow, timezone, sessionMinutes: 30, inputRevision,
    assignments, studyWindows, commitments, activeFocus: null, previousPlan: null });
  if (plan.shortfalls.length > 0 || plan.blocks.length === 0) {
    throw new Error("The example could not create a complete study plan for this date.");
  }
  return { ...draft, inputRevision, plan };
}

export function exampleDates(state: AppState): { shiftDate: string; repairDate: string } | null {
  const project = state.assignments.find((item) => item.id === "example:programming");
  const maths = state.assignments.find((item) => item.id === "example:maths");
  if (!project || !maths) return null;
  return {
    shiftDate: instantToLocalFields(project.dueAt, state.timezone).date,
    repairDate: instantToLocalFields(maths.dueAt, state.timezone).date,
  };
}

export function exampleShiftAdded(state: AppState): boolean {
  const dates = exampleDates(state);
  if (!dates) return false;
  const { shiftDate } = dates;
  return state.commitments.some((item) => {
    const start = instantToLocalFields(item.startAt, state.timezone);
    const end = instantToLocalFields(item.endAt, state.timezone);
    return start.date === shiftDate && start.time === "18:00" && end.date === shiftDate && end.time === "20:00";
  });
}
