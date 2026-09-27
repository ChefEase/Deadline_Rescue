/* eslint-disable @typescript-eslint/no-require-imports -- The Node runner transpiles local TypeScript with the installed compiler. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const typescript = require("typescript");

// Match the browser bundle's TypeScript loader and path alias for this focused calendar check.
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(output, filename);
};
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  const resolved = request.startsWith("@/") ? path.join(__dirname, "../src", request.slice(2)) : request;
  return resolveFilename.call(this, resolved, parent, isMain, options);
};

const { eventsForDate } = require("../src/features/planning/plan-events.ts");
const { newAppState } = require("../src/lib/persistence/storage.ts");
const { localDateTimeToInstant } = require("../src/lib/time/timezone.ts");

test("calendar separates planned study, free study hours, and a blocking commitment", () => {
  const date = "2026-09-28"; // Monday in Halifax.
  const at = (time) => localDateTimeToInstant(date, time, "America/Halifax");
  const assignment = { id: "maths", title: "Maths revision" };
  const block = { id: "block-1", assignmentId: assignment.id, startAt: at("16:00"), endAt: at("16:30"), state: "scheduled" };
  const state = {
    ...newAppState(), timezone: "America/Halifax",
    assignments: [assignment],
    studyWindows: [{ id: "hours-1", weekday: 1, localStart: "16:00", localEnd: "20:00", enabled: true }],
    commitments: [{ id: "work-1", title: "Work", startAt: at("17:00"), endAt: at("18:00"), category: "work" }],
    plan: { blocks: [block] },
  };
  const events = eventsForDate(state, date);
  assert.deepEqual(events.map((event) => event.kind), ["availability", "session", "commitment", "availability"]);
  assert.deepEqual(events.filter((event) => event.kind === "availability").map((event) => [event.startAt, event.endAt]), [
    [at("16:00"), at("17:00")], [at("18:00"), at("20:00")],
  ]);
  assert.equal(events.find((event) => event.kind === "session").assignment.title, "Maths revision");
  assert.equal(eventsForDate(state, "2026-09-29").length, 0);
});
