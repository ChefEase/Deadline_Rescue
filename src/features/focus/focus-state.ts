import type { ActiveFocus, AppState, StudyBlock } from "../../lib/schema/types";
import { schedulingInputsChanged } from "../../lib/scheduling/input-revision";
import { buildSchedule } from "../../lib/scheduling/scheduler";

export class FocusError extends Error {
  constructor(public readonly code: "not_ready" | "already_active" | "not_found" | "invalid_state" | "already_reviewed" | "invalid_review", message: string) {
    super(message);
    this.name = "FocusError";
  }
}

function blockForFocus(state: AppState): StudyBlock {
  const block = state.plan?.blocks.find((item) => item.id === state.activeFocus?.blockId);
  if (!block || block.assignmentId !== state.activeFocus?.assignmentId) {
    throw new FocusError("not_found", "The saved Focus session could not be found.");
  }
  return block;
}

/** An active session always wins over a route parameter, including encoded block IDs. */
export function focusBlockForRoute(state: AppState, sessionId: string): StudyBlock | undefined {
  let requestedId = sessionId;
  try { requestedId = decodeURIComponent(sessionId); } catch { /* A malformed link cannot override saved Focus. */ }
  const blockId = state.activeFocus?.blockId ?? requestedId;
  return state.plan?.blocks.find((block) => block.id === blockId);
}

/** Elapsed time is derived from persisted timestamps, never from interval ticks. */
export function elapsedFocusSeconds(focus: ActiveFocus, now: string): number {
  const running = focus.lastResumedAt ? Math.max(0, Math.floor((Date.parse(now) - Date.parse(focus.lastResumedAt)) / 1000)) : 0;
  return focus.accumulatedSeconds + running;
}

export function startFocus(state: AppState, blockId: string, focusId: string, now: string): AppState {
  if (state.activeFocus) throw new FocusError("already_active", "Finish or resume your current Focus session first.");
  if (state.workLogs.some((log) => log.focusId === focusId)) throw new FocusError("invalid_state", "This Focus identifier was already used.");
  const plan = state.plan;
  if (!plan || plan.inputRevision !== state.inputRevision || plan.horizonEndAt <= now ||
      plan.blocks.some((block) => block.state === "scheduled" && block.endAt <= now)) {
    throw new FocusError("not_ready", "Replan before starting Focus. Your saved sessions need an update.");
  }
  const block = plan.blocks.find((item) => item.id === blockId);
  const assignment = state.assignments.find((item) => item.id === block?.assignmentId);
  // In the synthetic example, a session may begin up to 15 minutes early for a short live demo.
  const earlyExampleStart = state.mode === "example" && block &&
    Date.parse(block.startAt) - Date.parse(now) <= 15 * 60_000;
  if (!block || block.state !== "scheduled" || !assignment || assignment.status !== "active" ||
      (block.startAt > now && !earlyExampleStart) || block.endAt <= now) {
    throw new FocusError("not_ready", "This session is not available to start now.");
  }
  const activeFocus: ActiveFocus = {
    id: focusId, blockId, assignmentId: block.assignmentId,
    startedAt: now, lastResumedAt: now, accumulatedSeconds: 0, state: "running",
  };
  return { ...state, activeFocus, plan: { ...plan,
    blocks: plan.blocks.map((item) => item.id === blockId ? { ...item, state: "active" } : item),
  } };
}

export function pauseFocus(state: AppState, now: string): AppState {
  const focus = state.activeFocus;
  if (!focus || focus.state !== "running") throw new FocusError("invalid_state", "This Focus session is not running.");
  return { ...state, activeFocus: {
    ...focus, state: "paused", accumulatedSeconds: elapsedFocusSeconds(focus, now), lastResumedAt: null,
  } };
}

export function resumeFocus(state: AppState, now: string): AppState {
  const focus = state.activeFocus;
  if (!focus || focus.state !== "paused") throw new FocusError("invalid_state", "This Focus session is not paused.");
  if (blockForFocus(state).endAt <= now) throw new FocusError("invalid_state", "The planned session ended. Review your actual work time now.");
  return { ...state, activeFocus: { ...focus, state: "running", lastResumedAt: now } };
}

export function endFocus(state: AppState, now: string): AppState {
  const focus = state.activeFocus;
  if (!focus || focus.state === "review") throw new FocusError("invalid_state", "This Focus session is already ready for review.");
  return { ...state, activeFocus: {
    ...focus, state: "review", accumulatedSeconds: elapsedFocusSeconds(focus, now), lastResumedAt: null,
  } };
}

export interface FocusReview {
  focusId: string;
  logId: string;
  actualMinutes: number;
  finished: boolean;
  remainingMinutes: number | null;
}

/** Save confirmed progress and a replacement future plan as one document transition. */
export function reviewFocus(state: AppState, review: FocusReview, now: string): AppState {
  if (state.workLogs.some((log) => log.focusId === review.focusId)) {
    throw new FocusError("already_reviewed", "This session's progress was already saved.");
  }
  const focus = state.activeFocus;
  if (!focus || focus.id !== review.focusId || focus.state !== "review" || !state.plan) {
    throw new FocusError("invalid_state", "End the current Focus session before saving progress.");
  }
  if (!Number.isSafeInteger(review.actualMinutes) || review.actualMinutes < 0 || review.actualMinutes > 1440 ||
      (!review.finished && (!Number.isSafeInteger(review.remainingMinutes) || review.remainingMinutes === null || review.remainingMinutes < 1))) {
    throw new FocusError("invalid_review", "Enter actual worked minutes and a positive amount of work left, or mark the assignment finished.");
  }
  const block = blockForFocus(state);
  if (block.state !== "active") throw new FocusError("invalid_state", "The saved session is no longer active.");
  const assignment = state.assignments.find((item) => item.id === focus.assignmentId);
  if (!assignment || assignment.status !== "active") throw new FocusError("invalid_state", "The assignment is no longer active.");
  const remainingAfter = review.finished ? 0 : review.remainingMinutes!;
  const updated = {
    ...state,
    activeFocus: null,
    assignments: state.assignments.map((item) => item.id === assignment.id ? {
      ...item,
      remainingMinutes: remainingAfter,
      status: review.finished ? "completed" as const : "active" as const,
      completedAt: review.finished ? now : null,
      updatedAt: now,
    } : item),
    workLogs: [...state.workLogs, {
      id: review.logId,
      focusId: focus.id,
      assignmentId: assignment.id,
      confirmedWorkedMinutes: review.actualMinutes,
      remainingBefore: assignment.remainingMinutes,
      remainingAfter,
      finishedAssignment: review.finished,
      savedAt: now,
    }],
    plan: { ...state.plan, blocks: state.plan.blocks.map((item) => item.id === block.id
      ? { ...item, state: review.actualMinutes > 0 ? "completed" as const : "missed" as const } : item) },
  };
  const inputRevision = state.inputRevision + (schedulingInputsChanged(state, updated) ? 1 : 0);
  const future = buildSchedule({
    now, timezone: state.timezone, sessionMinutes: state.preferences.sessionMinutes, inputRevision,
    assignments: updated.assignments, studyWindows: state.studyWindows, commitments: state.commitments,
    activeFocus: null, previousPlan: updated.plan,
  });
  return { ...updated, inputRevision, plan: future };
}
