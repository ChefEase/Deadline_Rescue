import type { Assignment, Plan, StudyBlock } from "../schema/types";

export interface AssignmentPlanChange {
  assignmentId: string;
  title: string;
  movedSessions: number;
  addedSessions: number;
  removedSessions: number;
  missedSessions: number;
  unscheduledBefore: number;
  unscheduledAfter: number;
}

function duration(block: StudyBlock): number {
  return (Date.parse(block.endAt) - Date.parse(block.startAt)) / 60_000;
}

/** Compare future sessions; a matching duration at a new time counts as a move. */
export function summarizePlanChanges(before: Plan, after: Plan, assignments: Assignment[], now: string): AssignmentPlanChange[] {
  const ids = new Set([
    ...before.blocks.map((block) => block.assignmentId),
    ...after.blocks.map((block) => block.assignmentId),
    ...before.shortfalls.map((shortfall) => shortfall.assignmentId),
    ...after.shortfalls.map((shortfall) => shortfall.assignmentId),
  ]);
  const titles = new Map(assignments.map((assignment) => [assignment.id, assignment.title]));

  return [...ids].sort((a, b) => (titles.get(a) ?? a).localeCompare(titles.get(b) ?? b)).flatMap((assignmentId) => {
    const oldFuture = before.blocks.filter((block) => block.assignmentId === assignmentId && block.state === "scheduled" && block.endAt > now);
    const newFuture = after.blocks.filter((block) => block.assignmentId === assignmentId && block.state === "scheduled" && block.endAt > now);
    const newByTime = new Set(newFuture.map((block) => `${block.startAt}|${block.endAt}`));
    const oldByTime = new Set(oldFuture.map((block) => `${block.startAt}|${block.endAt}`));
    const oldChanged = oldFuture.filter((block) => !newByTime.has(`${block.startAt}|${block.endAt}`));
    const newChanged = newFuture.filter((block) => !oldByTime.has(`${block.startAt}|${block.endAt}`));

    // Pair equal-length sessions first; changed session lengths remain additions/removals.
    const oldCounts = new Map<number, number>();
    const newCounts = new Map<number, number>();
    for (const block of oldChanged) oldCounts.set(duration(block), (oldCounts.get(duration(block)) ?? 0) + 1);
    for (const block of newChanged) newCounts.set(duration(block), (newCounts.get(duration(block)) ?? 0) + 1);
    let movedSessions = 0;
    for (const [minutes, oldCount] of oldCounts) movedSessions += Math.min(oldCount, newCounts.get(minutes) ?? 0);

    const missedSessions = before.blocks.filter((block) =>
      block.assignmentId === assignmentId && block.state === "scheduled" && block.endAt <= now &&
      after.blocks.some((next) => next.id === block.id && next.state === "missed")).length;
    const unscheduledBefore = before.shortfalls.find((item) => item.assignmentId === assignmentId)?.unscheduledMinutes ?? 0;
    const unscheduledAfter = after.shortfalls.find((item) => item.assignmentId === assignmentId)?.unscheduledMinutes ?? 0;
    const change = {
      assignmentId,
      title: titles.get(assignmentId) ?? "Assignment",
      movedSessions,
      addedSessions: newChanged.length - movedSessions,
      removedSessions: oldChanged.length - movedSessions,
      missedSessions,
      unscheduledBefore,
      unscheduledAfter,
    };
    return movedSessions || change.addedSessions || change.removedSessions || missedSessions ||
      unscheduledBefore !== unscheduledAfter || unscheduledAfter > 0 ? [change] : [];
  });
}
