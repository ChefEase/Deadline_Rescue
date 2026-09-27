import type { Assignment, Commitment, StudyWindow } from "../schema/types";
import type { SchedulerInput } from "../scheduling/scheduler";

const createdAt = "2026-09-28T12:00:00.000Z";

function assignment(id: string, title: string, dueAt: string, remainingMinutes: number): Assignment {
  return {
    id, title, course: "", dueAt, remainingMinutes, status: "active", notes: "",
    source: null, createdAt, updatedAt: createdAt, completedAt: null,
  };
}

function window(id: string, weekday: StudyWindow["weekday"], localStart: string, localEnd: string, enabled = true): StudyWindow {
  return { id, weekday, localStart, localEnd, enabled };
}

function commitment(id: string, title: string, startAt: string, endAt: string): Commitment {
  return { id, title, startAt, endAt, category: "work" };
}

/** All dated fixture values are fixed UTC instants for Halifax in September 2026. */
export function initialFixture(): SchedulerInput {
  return {
    now: "2026-09-28T18:00:00.000Z", // Monday 3:00 p.m. in Halifax.
    timezone: "America/Halifax",
    sessionMinutes: 30,
    inputRevision: 1,
    assignments: [
      assignment("programming", "Programming", "2026-09-29T23:00:00.000Z", 240),
      assignment("maths", "Maths", "2026-09-30T23:00:00.000Z", 120),
    ],
    studyWindows: [
      window("monday", 1, "16:00", "20:00"),
      window("tuesday", 2, "16:00", "20:00"),
      window("wednesday", 3, "16:00", "18:00", false),
    ],
    commitments: [commitment("monday-shift", "Work shift", "2026-09-28T21:00:00.000Z", "2026-09-28T23:00:00.000Z")],
    activeFocus: null,
    previousPlan: null,
  };
}

export function disruptedFixture(): SchedulerInput {
  const initial = initialFixture();
  return {
    ...initial,
    inputRevision: 2,
    commitments: [...initial.commitments, commitment("tuesday-shift", "Work shift", "2026-09-29T21:00:00.000Z", "2026-09-29T23:00:00.000Z")],
  };
}

export function recoveredFixture(): SchedulerInput {
  const disrupted = disruptedFixture();
  return {
    ...disrupted,
    inputRevision: 3,
    studyWindows: disrupted.studyWindows.map((item) => item.id === "wednesday" ? { ...item, enabled: true } : item),
  };
}
