import type { AppState, Plan } from "@/lib/schema/types";
import { buildSchedule } from "@/lib/scheduling/scheduler";

/** Validate setup before generating a plan; this function never writes browser state. */
export function buildPlanForState(state: AppState, now: string): Plan {
  if (!state.assignments.some((assignment) => assignment.status === "active")) {
    throw new Error("Add an active assignment before building a plan.");
  }
  if (!state.availabilityConfirmedAt || !state.studyWindows.some((window) => window.enabled)) {
    throw new Error("Review and save at least one study window before building a plan.");
  }
  return buildSchedule({
    now,
    timezone: state.timezone,
    sessionMinutes: state.preferences.sessionMinutes,
    inputRevision: state.inputRevision,
    assignments: state.assignments,
    studyWindows: state.studyWindows,
    commitments: state.commitments,
    activeFocus: state.activeFocus,
    previousPlan: state.plan,
  });
}
