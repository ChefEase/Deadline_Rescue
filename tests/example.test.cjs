/* eslint-disable @typescript-eslint/no-require-imports -- The Node runner transpiles local TypeScript with the installed compiler. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const typescript = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(output, filename);
};

// Match the project's TypeScript path alias for persisted-state validation.
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  const resolved = request.startsWith("@/") ? path.join(__dirname, "../src", request.slice(2)) : request;
  return resolveFilename.call(this, resolved, parent, isMain, options);
};

const { createExampleState, exampleDates, EXAMPLE_RECOVERY_ID } = require("../src/lib/demo/sample-data.ts");
const { buildSchedule } = require("../src/lib/scheduling/scheduler.ts");
const { isAppState } = require("../src/lib/schema/validate.ts");
const { startFocus, endFocus, reviewFocus } = require("../src/features/focus/focus-state.ts");
const { localDateTimeToInstant } = require("../src/lib/time/timezone.ts");

function emptyState(timezone) {
  return { schemaVersion: 1, documentRevision: 0, inputRevision: 0, mode: "personal", timezone,
    availabilityConfirmedAt: null, preferences: { sessionMinutes: 30 }, assignments: [],
    studyWindows: [], commitments: [], plan: null, activeFocus: null, workLogs: [] };
}

function replan(state, now) {
  return buildSchedule({ now, timezone: state.timezone, sessionMinutes: state.preferences.sessionMinutes,
    inputRevision: state.inputRevision, assignments: state.assignments, studyWindows: state.studyWindows,
    commitments: state.commitments, activeFocus: null, previousPlan: state.plan });
}

test("relative example starts with a full plan, a shift creates a shortfall, and new hours repair it", () => {
  for (const [timezone, now] of [
    ["America/Halifax", "2026-09-27T16:08:00.000Z"],
    ["America/Halifax", "2026-09-28T02:50:00.000Z"],
    ["America/Halifax", "2027-03-14T04:50:00.000Z"],
    ["America/Halifax", "2027-11-07T05:50:00.000Z"],
    ["America/Halifax", "2027-11-07T04:50:00.000Z"],
    ["UTC", "2026-12-31T23:50:00.000Z"],
    ["Asia/Tokyo", "2026-10-01T12:50:00.000Z"],
  ]) {
    const example = createExampleState(emptyState(timezone), now);
    assert.equal(example.mode, "example");
    assert.equal(isAppState(example), true, `${timezone} ${now}: valid saved document`);
    assert.equal(example.plan.shortfalls.length, 0, `${timezone} ${now}: initial fit`);
    assert.ok(example.plan.blocks.some((block) => block.startAt <= now && block.endAt > now), `${timezone} ${now}: current Focus`);
    const { shiftDate } = exampleDates(example);
    const shifted = { ...example, inputRevision: example.inputRevision + 1,
      commitments: [...example.commitments, {
        id: "new-shift", title: "Work shift", category: "work",
        startAt: localDateTimeToInstant(shiftDate, "18:00", timezone),
        endAt: localDateTimeToInstant(shiftDate, "20:00", timezone),
      }] };
    const afterThreeMinutes = new Date(Date.parse(now) + 3 * 60_000).toISOString();
    shifted.plan = replan(shifted, afterThreeMinutes);
    assert.ok(shifted.plan.shortfalls.some((item) => item.assignmentId === "example:maths"), `${timezone} ${now}: shift shortfall`);
    const repaired = { ...shifted, inputRevision: shifted.inputRevision + 1,
      studyWindows: shifted.studyWindows.map((item) => item.id === EXAMPLE_RECOVERY_ID ? { ...item, enabled: true } : item) };
    repaired.plan = replan(repaired, afterThreeMinutes);
    assert.equal(repaired.plan.shortfalls.length, 0, `${timezone} ${now}: recovered fit`);
    assert.equal(isAppState(repaired), true, `${timezone} ${now}: valid repaired document`);
  }
});

test("example Focus may start shortly before a session and records actual worked minutes", () => {
  const now = "2026-09-27T16:08:00.000Z";
  const example = createExampleState(emptyState("America/Halifax"), now);
  const replanAt = "2026-09-27T16:11:00.000Z";
  example.inputRevision++;
  example.plan = replan(example, replanAt);
  const next = example.plan.blocks.find((block) => block.state === "scheduled" && block.startAt > replanAt);
  assert.ok(next && Date.parse(next.startAt) - Date.parse(replanAt) <= 15 * 60_000);
  const started = startFocus(example, next.id, "example-focus", replanAt);
  assert.equal(started.activeFocus.state, "running");
  assert.throws(() => startFocus({ ...example, mode: "personal" }, next.id, "personal-focus", replanAt));
  const endedAt = "2026-09-27T16:13:00.000Z";
  const ended = endFocus(started, endedAt);
  const saved = reviewFocus(ended, { focusId: "example-focus", logId: "example-log", actualMinutes: 2,
    finished: false, remainingMinutes: 148 }, endedAt);
  assert.equal(saved.workLogs[0].confirmedWorkedMinutes, 2);
  assert.equal(saved.assignments.find((item) => item.id === "example:programming").remainingMinutes, 148);
});
