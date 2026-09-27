/* eslint-disable @typescript-eslint/no-require-imports -- The Node runner transpiles local TypeScript with the installed compiler. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const typescript = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(output, filename);
};

const { initialFixture } = require("../src/lib/demo/fixture.ts");
const { buildSchedule, SchedulingError } = require("../src/lib/scheduling/scheduler.ts");
const { startFocus, pauseFocus, resumeFocus, endFocus, elapsedFocusSeconds, focusBlockForRoute, reviewFocus, FocusError } = require("../src/features/focus/focus-state.ts");

function readyState() {
  const input = initialFixture();
  const plan = buildSchedule(input);
  return {
    schemaVersion: 1, documentRevision: 0, inputRevision: input.inputRevision, mode: "personal",
    timezone: input.timezone, availabilityConfirmedAt: input.now,
    preferences: { sessionMinutes: input.sessionMinutes }, assignments: input.assignments,
    studyWindows: input.studyWindows, commitments: input.commitments,
    plan, activeFocus: null, workLogs: [],
  };
}

test("Focus starts only in a current, valid session and blocks a second start", () => {
  const state = readyState();
  const first = state.plan.blocks[0];
  assert.throws(() => startFocus(state, first.id, "focus-1", "2026-09-28T18:59:00.000Z"), (error) => error instanceof FocusError && error.code === "not_ready");
  const started = startFocus(state, first.id, "focus-1", "2026-09-28T19:05:00.000Z");
  assert.equal(started.plan.blocks.find((block) => block.id === first.id).state, "active");
  assert.throws(() => startFocus(started, state.plan.blocks[1].id, "focus-2", "2026-09-28T19:06:00.000Z"), (error) => error instanceof FocusError && error.code === "already_active");
  assert.throws(() => startFocus({ ...state, inputRevision: state.inputRevision + 1 }, first.id, "focus-3", "2026-09-28T19:05:00.000Z"), (error) => error instanceof FocusError && error.code === "not_ready");
});

test("saved Focus opens even when the route has an encoded or different session ID", () => {
  const state = readyState();
  const first = state.plan.blocks[0];
  const started = startFocus(state, first.id, "focus-1", "2026-09-28T19:05:00.000Z");
  assert.equal(focusBlockForRoute(state, encodeURIComponent(first.id)).id, first.id);
  assert.equal(focusBlockForRoute(started, encodeURIComponent(first.id)).id, first.id);
  assert.equal(focusBlockForRoute(started, state.plan.blocks[1].id).id, first.id);
});

test("elapsed time survives refresh and pause/resume without counting paused time", () => {
  const state = readyState();
  const started = startFocus(state, state.plan.blocks[0].id, "focus-1", "2026-09-28T19:05:00.000Z");
  const refreshed = JSON.parse(JSON.stringify(started));
  assert.equal(elapsedFocusSeconds(refreshed.activeFocus, "2026-09-28T19:08:15.000Z"), 195);
  const paused = pauseFocus(refreshed, "2026-09-28T19:08:15.000Z");
  assert.equal(elapsedFocusSeconds(paused.activeFocus, "2026-09-28T19:10:00.000Z"), 195);
  const resumed = resumeFocus(paused, "2026-09-28T19:10:00.000Z");
  assert.equal(elapsedFocusSeconds(resumed.activeFocus, "2026-09-28T19:11:00.000Z"), 255);
  const ended = endFocus(resumed, "2026-09-28T19:11:00.000Z");
  assert.equal(ended.activeFocus.state, "review");
  assert.equal(ended.activeFocus.accumulatedSeconds, 255);
});

test("review saves confirmed minutes once and recomputes future work", () => {
  const state = readyState();
  const first = state.plan.blocks[0];
  const started = startFocus(state, first.id, "focus-1", "2026-09-28T19:05:00.000Z");
  const ended = endFocus(started, "2026-09-28T19:15:00.000Z");
  const review = { focusId: "focus-1", logId: "log-1", actualMinutes: 7, finished: false, remainingMinutes: 90 };
  const saved = reviewFocus(ended, review, "2026-09-28T19:16:00.000Z");
  assert.equal(saved.activeFocus, null);
  assert.equal(saved.assignments.find((item) => item.id === first.assignmentId).remainingMinutes, 90);
  assert.equal(saved.workLogs.length, 1);
  assert.equal(saved.workLogs[0].confirmedWorkedMinutes, 7);
  assert.equal(saved.plan.blocks.find((block) => block.id === first.id).state, "completed");
  assert.equal(saved.plan.inputRevision, saved.inputRevision);
  assert.ok(saved.plan.blocks.filter((block) => block.state === "scheduled").every((block) => block.startAt >= "2026-09-28T19:16:00.000Z"));
  assert.throws(() => reviewFocus(saved, review, "2026-09-28T19:17:00.000Z"), (error) => error instanceof FocusError && error.code === "already_reviewed");
});

test("zero confirmed work remains uncompleted unless the student marks the assignment finished", () => {
  const state = readyState();
  const first = state.plan.blocks[0];
  const ended = endFocus(startFocus(state, first.id, "focus-1", "2026-09-28T19:05:00.000Z"), "2026-09-28T19:06:00.000Z");
  assert.throws(() => reviewFocus(ended, { focusId: "focus-1", logId: "log-1", actualMinutes: 0, finished: false, remainingMinutes: 0 }, "2026-09-28T19:07:00.000Z"), (error) => error instanceof FocusError && error.code === "invalid_review");
  const saved = reviewFocus(ended, { focusId: "focus-1", logId: "log-1", actualMinutes: 0, finished: true, remainingMinutes: null }, "2026-09-28T19:07:00.000Z");
  assert.equal(saved.assignments.find((item) => item.id === first.assignmentId).status, "completed");
  assert.equal(saved.plan.blocks.find((block) => block.id === first.id).state, "missed");
  assert.equal(saved.plan.blocks.filter((block) => block.assignmentId === first.assignmentId && block.state === "scheduled").length, 0);
});

test("a new commitment overlapping active Focus stops replanning", () => {
  const state = readyState();
  const first = state.plan.blocks[0];
  const started = startFocus(state, first.id, "focus-1", "2026-09-28T19:05:00.000Z");
  const input = initialFixture();
  input.now = "2026-09-28T19:06:00.000Z";
  input.previousPlan = started.plan;
  input.activeFocus = started.activeFocus;
  input.commitments.push({ id: "conflict", title: "New shift", category: "work", startAt: first.startAt, endAt: first.endAt });
  assert.throws(() => buildSchedule(input), (error) => error instanceof SchedulingError && error.code === "active_focus_conflict");
});
