import type { AppState } from "../schema/types";

/** Compare only values the scheduler uses; labels and notes do not invalidate a plan. */
export function schedulingInputsChanged(before: AppState, after: AppState): boolean {
  const signature = (state: AppState) => JSON.stringify({
    timezone: state.timezone,
    sessionMinutes: state.preferences.sessionMinutes,
    assignments: state.assignments
      .map(({ id, status, dueAt, remainingMinutes, createdAt }) => ({ id, status, dueAt, remainingMinutes, createdAt }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    studyWindows: state.studyWindows
      .map(({ weekday, localStart, localEnd, enabled }) => ({ weekday, localStart, localEnd, enabled }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    commitments: state.commitments
      .map(({ startAt, endAt }) => ({ startAt, endAt }))
      .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.endAt.localeCompare(b.endAt)),
  });

  return signature(before) !== signature(after);
}
