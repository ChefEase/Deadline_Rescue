/* eslint-disable @typescript-eslint/no-require-imports -- The Node test runner loads local TypeScript through the installed compiler. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const typescript = require("typescript");

// TypeScript is already a project dependency; this focused runner installs nothing.
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(output, filename);
};

const { initialFixture, disruptedFixture, recoveredFixture } = require("../src/lib/demo/fixture.ts");
const { buildSchedule, SchedulingError } = require("../src/lib/scheduling/scheduler.ts");
const { summarizePlanChanges } = require("../src/lib/scheduling/changes.ts");
const { schedulingInputsChanged } = require("../src/lib/scheduling/input-revision.ts");
const { mergeCommitmentIntervals } = require("../src/lib/scheduling/intervals.ts");
const { localDateTimeCandidates } = require("../src/lib/time/timezone.ts");

function scheduledMinutes(plan, assignmentId) {
  return plan.blocks
    .filter((block) => block.assignmentId === assignmentId && block.state === "scheduled")
    .reduce((total, block) => total + (Date.parse(block.endAt) - Date.parse(block.startAt)) / 60_000, 0);
}

test("fixed Halifax fixture fits Programming and Maths in the expected periods", () => {
  const input = initialFixture();
  const plan = buildSchedule(input);
  assert.equal(scheduledMinutes(plan, "programming"), 240);
  assert.equal(scheduledMinutes(plan, "maths"), 120);
  assert.deepEqual(plan.shortfalls, []);
  assert.equal(plan.horizonEndAt, "2026-10-12T03:00:00.000Z");
  assert.deepEqual(plan.blocks.filter((block) => block.assignmentId === "programming").map((block) => block.startAt), [
    "2026-09-28T19:00:00.000Z", "2026-09-28T19:30:00.000Z",
    "2026-09-28T20:00:00.000Z", "2026-09-28T20:30:00.000Z",
    "2026-09-29T19:00:00.000Z", "2026-09-29T19:30:00.000Z",
    "2026-09-29T20:00:00.000Z", "2026-09-29T20:30:00.000Z",
  ]);
  assert.equal(buildSchedule(input).blocks[0].id, plan.blocks[0].id);
});

test("Tuesday shift creates an exact Maths shortfall without discarding feasible sessions", () => {
  const input = disruptedFixture();
  const plan = buildSchedule(input);
  assert.equal(scheduledMinutes(plan, "programming"), 240);
  assert.equal(scheduledMinutes(plan, "maths"), 0);
  assert.deepEqual(plan.shortfalls, [{
    assignmentId: "maths", requestedMinutes: 120, allocatedMinutes: 0,
    unscheduledMinutes: 120, reason: "insufficient_availability",
  }]);
  assert.ok(plan.blocks.every((block) => block.endAt <= input.assignments.find((item) => item.id === block.assignmentId).dueAt));
});

test("Wednesday availability repairs the Maths shortfall", () => {
  const plan = buildSchedule(recoveredFixture());
  assert.equal(scheduledMinutes(plan, "maths"), 120);
  assert.deepEqual(plan.shortfalls, []);
  assert.equal(plan.blocks.find((block) => block.assignmentId === "maths").startAt, "2026-09-30T19:00:00.000Z");
});

test("overlapping commitments form one blocked union", () => {
  const input = initialFixture();
  const union = mergeCommitmentIntervals([
    { ...input.commitments[0], startAt: "2026-09-28T20:00:00.000Z" },
    { ...input.commitments[0], id: "second", startAt: "2026-09-28T21:00:00.000Z", endAt: "2026-09-29T00:00:00.000Z" },
  ]);
  assert.deepEqual(union, [{ startAt: "2026-09-28T20:00:00.000Z", endAt: "2026-09-29T00:00:00.000Z" }]);

  const schedulingInput = initialFixture();
  schedulingInput.commitments.push({
    id: "overlap", title: "Class", category: "class",
    startAt: "2026-09-28T20:00:00.000Z", endAt: "2026-09-28T22:00:00.000Z",
  });
  const plan = buildSchedule(schedulingInput);
  assert.equal(scheduledMinutes(plan, "programming") + scheduledMinutes(plan, "maths"), 300);
  assert.equal(plan.shortfalls[0].unscheduledMinutes, 60);
});

test("off-grid study time rounds inward and never crosses blocked minutes", () => {
  const input = initialFixture();
  input.now = "2026-09-29T18:00:00.000Z";
  input.studyWindows = [{ id: "odd", weekday: 2, localStart: "16:07", localEnd: "16:53", enabled: true }];
  input.commitments = [];
  input.assignments = [{ ...input.assignments[0], remainingMinutes: 30 }];
  const plan = buildSchedule(input);
  assert.deepEqual(plan.blocks.map((block) => [block.startAt, block.endAt]), [[
    "2026-09-29T19:15:00.000Z", "2026-09-29T19:45:00.000Z",
  ]]);

  input.commitments = [{
    id: "middle", title: "Short interruption", category: null,
    startAt: "2026-09-29T19:20:00.000Z", endAt: "2026-09-29T19:25:00.000Z",
  }];
  const interrupted = buildSchedule(input);
  assert.equal(scheduledMinutes(interrupted, "programming"), 15);
  assert.equal(interrupted.shortfalls[0].unscheduledMinutes, 15);
  assert.ok(interrupted.blocks.every((block) => block.startAt >= "2026-09-29T19:30:00.000Z"));
});

test("a 45-minute estimate ends with a real 15-minute session", () => {
  const input = initialFixture();
  input.assignments = [{ ...input.assignments[0], remainingMinutes: 45 }];
  const blocks = buildSchedule(input).blocks;
  assert.deepEqual(blocks.map((block) => (Date.parse(block.endAt) - Date.parse(block.startAt)) / 60_000), [30, 15]);
});

test("overdue and outside-horizon work are excluded from allocation", () => {
  const input = initialFixture();
  input.assignments = [
    { ...input.assignments[0], id: "overdue", dueAt: "2026-09-28T17:00:00.000Z" },
    { ...input.assignments[1], id: "later", dueAt: "2026-10-12T03:00:00.000Z" },
  ];
  const plan = buildSchedule(input);
  assert.deepEqual(plan.overdueAssignmentIds, ["overdue"]);
  assert.deepEqual(plan.outsideHorizonIds, ["later"]);
  assert.deepEqual(plan.blocks, []);
});

test("a study window ending at midnight allocates its full final hour", () => {
  const input = initialFixture();
  input.now = "2026-09-29T23:00:00.000Z"; // Tuesday 8:00 p.m. Halifax.
  input.studyWindows = [{ id: "late", weekday: 2, localStart: "21:00", localEnd: "24:00", enabled: true }];
  input.commitments = [];
  input.assignments = [{ ...input.assignments[0], dueAt: "2026-09-30T04:00:00.000Z", remainingMinutes: 180 }];
  const plan = buildSchedule(input);
  assert.equal(scheduledMinutes(plan, "programming"), 180);
  assert.equal(plan.blocks.at(-1).endAt, "2026-09-30T03:00:00.000Z");
});

test("DST spring gap is skipped and fall repeated hour chooses a consistent instant", () => {
  const spring = initialFixture();
  spring.now = "2026-03-08T04:00:00.000Z";
  spring.studyWindows = [{ id: "spring", weekday: 7, localStart: "01:00", localEnd: "04:00", enabled: true }];
  spring.commitments = [];
  spring.assignments = [{ ...spring.assignments[0], dueAt: "2026-03-08T09:00:00.000Z", remainingMinutes: 120 }];
  assert.equal(scheduledMinutes(buildSchedule(spring), "programming"), 120);
  spring.studyWindows[0].localStart = "02:30"; // This wall time never occurs.
  assert.equal(scheduledMinutes(buildSchedule(spring), "programming"), 0);

  const repeated = localDateTimeCandidates("2026-11-01", "01:30", "America/Halifax");
  assert.equal(repeated.length, 2);
  assert.equal(Date.parse(repeated[1]) - Date.parse(repeated[0]), 60 * 60_000);

  const fall = initialFixture();
  fall.now = "2026-11-01T03:00:00.000Z";
  fall.studyWindows = [{ id: "fall", weekday: 7, localStart: "01:00", localEnd: "03:00", enabled: true }];
  fall.commitments = [];
  fall.assignments = [{ ...fall.assignments[0], dueAt: "2026-11-01T08:00:00.000Z", remainingMinutes: 180 }];
  assert.equal(scheduledMinutes(buildSchedule(fall), "programming"), 180);
});

test("active Focus time is reserved and conflicting commitments stop replanning", () => {
  const input = initialFixture();
  const previousPlan = buildSchedule(input);
  const activeBlock = previousPlan.blocks[0];
  input.now = "2026-09-28T19:05:00.000Z";
  input.previousPlan = previousPlan;
  input.activeFocus = {
    id: "focus-1", blockId: activeBlock.id, assignmentId: activeBlock.assignmentId,
    startedAt: "2026-09-28T19:00:00.000Z", lastResumedAt: "2026-09-28T19:00:00.000Z",
    accumulatedSeconds: 0, state: "running",
  };
  const plan = buildSchedule(input);
  assert.equal(plan.blocks.filter((block) => block.state === "active").length, 1);
  assert.equal(scheduledMinutes(plan, "programming"), 210);
  assert.ok(plan.blocks.filter((block) => block.state === "scheduled").every((block) => block.startAt >= activeBlock.endAt || block.endAt <= activeBlock.startAt));

  input.commitments.push({ id: "conflict", title: "New shift", startAt: activeBlock.startAt, endAt: activeBlock.endAt, category: "work" });
  assert.throws(() => buildSchedule(input), (error) => error instanceof SchedulingError && error.code === "active_focus_conflict");
});

test("replanning keeps completed history and marks expired sessions missed", () => {
  const input = initialFixture();
  const previous = buildSchedule(input);
  input.previousPlan = {
    ...previous,
    blocks: previous.blocks.map((block, index) => index === 0 ? { ...block, state: "completed" } : block),
  };
  input.now = "2026-09-28T20:10:00.000Z";
  const plan = buildSchedule(input);
  assert.equal(plan.blocks.find((block) => block.id === previous.blocks[0].id).state, "completed");
  assert.equal(plan.blocks.find((block) => block.id === previous.blocks[1].id).state, "missed");
  assert.ok(plan.blocks.filter((block) => block.state === "scheduled").every((block) => block.startAt >= input.now));
  const changes = summarizePlanChanges(previous, plan, input.assignments, input.now);
  assert.equal(changes.find((change) => change.assignmentId === "programming").missedSessions, 1);
});

test("replan summary reports the shift shortfall and its recovery by assignment", () => {
  const initial = initialFixture();
  const first = buildSchedule(initial);
  const disrupted = disruptedFixture();
  disrupted.previousPlan = first;
  const second = buildSchedule(disrupted);
  const disruption = summarizePlanChanges(first, second, disrupted.assignments, disrupted.now);
  const mathsDisruption = disruption.find((change) => change.assignmentId === "maths");
  assert.equal(mathsDisruption.unscheduledBefore, 0);
  assert.equal(mathsDisruption.unscheduledAfter, 120);
  assert.ok(mathsDisruption.removedSessions > 0);

  const recovered = recoveredFixture();
  recovered.previousPlan = second;
  const third = buildSchedule(recovered);
  const recovery = summarizePlanChanges(second, third, recovered.assignments, recovered.now);
  const mathsRecovery = recovery.find((change) => change.assignmentId === "maths");
  assert.equal(mathsRecovery.unscheduledBefore, 120);
  assert.equal(mathsRecovery.unscheduledAfter, 0);
  assert.ok(mathsRecovery.addedSessions > 0);
  assert.equal(recovered.assignments.find((item) => item.id === "maths").remainingMinutes, 120);
});

test("only scheduling fields invalidate the plan", () => {
  const fixture = initialFixture();
  const base = {
    timezone: fixture.timezone, preferences: { sessionMinutes: fixture.sessionMinutes },
    assignments: fixture.assignments, studyWindows: fixture.studyWindows, commitments: fixture.commitments,
  };
  assert.equal(schedulingInputsChanged(base, { ...base, assignments: base.assignments.map((item) => ({ ...item, notes: "Read chapter 3" })) }), false);
  assert.equal(schedulingInputsChanged(base, { ...base, assignments: base.assignments.map((item) => ({ ...item, remainingMinutes: item.remainingMinutes + 15 })) }), true);
  assert.equal(schedulingInputsChanged(base, { ...base, assignments: base.assignments.map((item) => ({ ...item, dueAt: "2026-10-01T23:00:00.000Z" })) }), true);
  assert.equal(schedulingInputsChanged(base, { ...base, studyWindows: base.studyWindows.map((item) => ({ ...item, enabled: false })) }), true);
  assert.equal(schedulingInputsChanged(base, { ...base, commitments: [...base.commitments, { id: "shift", title: "Shift", startAt: "2026-09-29T19:00:00.000Z", endAt: "2026-09-29T20:00:00.000Z" }] }), true);
  assert.equal(schedulingInputsChanged(base, { ...base, timezone: "UTC" }), true);
  assert.equal(schedulingInputsChanged(base, { ...base, preferences: { sessionMinutes: 45 } }), true);
});

test("replan comparison separates unchanged, moved, added, and removed sessions", () => {
  const block = (id, assignmentId, hour) => ({
    id, assignmentId, startAt: `2026-10-01T${hour}:00:00.000Z`,
    endAt: `2026-10-01T${hour}:30:00.000Z`, state: "scheduled",
  });
  const before = { blocks: [block("a1", "programming", "15"), block("a2", "programming", "16"), block("b1", "maths", "17")], shortfalls: [] };
  const after = { blocks: [block("a2", "programming", "16"), block("a3", "programming", "18"), block("a4", "programming", "19")], shortfalls: [] };
  const changes = summarizePlanChanges(before, after, initialFixture().assignments, "2026-10-01T12:00:00.000Z");
  assert.deepEqual(changes.map(({ title, movedSessions, addedSessions, removedSessions }) => ({ title, movedSessions, addedSessions, removedSessions })), [
    { title: "Maths", movedSessions: 0, addedSessions: 0, removedSessions: 1 },
    { title: "Programming", movedSessions: 1, addedSessions: 1, removedSessions: 0 },
  ]);
});
