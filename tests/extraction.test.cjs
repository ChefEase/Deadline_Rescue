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

const { parseExtractionRequest, parseModelDrafts, confirmedAssignment, duplicateAssignment } = require("../src/lib/extraction/drafts.ts");
const { extractWithReplicate } = require("../src/lib/extraction/replicate.ts");

const text = "Math essay due October 2 at 9 PM. Chemistry report due later.";
const suggestion = {
  title: "Math essay", course: "Math", date: "2026-10-02", time: "21:00",
  deadlineText: "October 2 at 9 PM", deadlineQuote: "due October 2 at 9 PM",
  excerpt: "Math essay due October 2 at 9 PM.", warnings: [],
};

test("request validates text length and timezone", () => {
  assert.ok(parseExtractionRequest({ text, timezone: "America/Halifax", referenceDate: "2026-09-27" }));
  assert.equal(parseExtractionRequest({ text: "x".repeat(12_001), timezone: "America/Halifax", referenceDate: "2026-09-27" }), null);
  assert.equal(parseExtractionRequest({ text, timezone: "Unknown/Zone", referenceDate: "2026-09-27" }), null);
});

test("source quotes must match and extra suggestions are flagged", () => {
  const result = parseModelDrafts(JSON.stringify({ assignments: [{ ...suggestion, deadlineQuote: "made up", excerpt: "made up" }, ...Array(10).fill(suggestion)] }), text);
  assert.equal(result.drafts.length, 10);
  assert.equal(result.limitWarning, true);
  assert.equal(result.drafts[0].deadlineQuote, null);
  assert.equal(result.drafts[0].excerpt, "");
  assert.ok(result.drafts[0].warnings.some((warning) => warning.includes("verified")));
  assert.throws(() => parseModelDrafts(JSON.stringify({ assignments: [{ date: "2026-10-02" }] }), text));
});

test("only an explicitly confirmed draft with a full deadline and effort can be saved", () => {
  const extracted = parseModelDrafts(JSON.stringify({ assignments: [suggestion] }), text).drafts[0];
  const review = { ...extracted, id: "draft-1", originalDate: extracted.date, originalTime: extracted.time,
    hours: "2", minutes: "30", confirmed: false, skipped: false };
  assert.throws(() => confirmedAssignment(review, "America/Halifax", "2026-09-27T12:00:00.000Z", "assignment-1"));
  assert.throws(() => confirmedAssignment({ ...review, confirmed: true, time: "" }, "America/Halifax", "2026-09-27T12:00:00.000Z", "assignment-1"));
  const saved = confirmedAssignment({ ...review, confirmed: true }, "America/Halifax", "2026-09-27T12:00:00.000Z", "assignment-1");
  assert.equal(saved.remainingMinutes, 150);
  assert.equal(saved.source.deadlineQuote, suggestion.deadlineQuote);
  assert.equal(saved.source.editedByUser, false);
  assert.equal(duplicateAssignment(" MATH  essay ", saved.dueAt, [saved]), true);
  assert.equal(duplicateAssignment("Math essay", "2026-10-04T00:00:00.000Z", [saved]), false);
});

test("missing or ambiguous extracted deadlines require a corrected date and time", () => {
  const missing = parseModelDrafts(JSON.stringify({ assignments: [{ ...suggestion, date: "", time: "", warnings: ["Deadline is unclear."] }] }), text).drafts[0];
  const review = { ...missing, id: "draft-2", originalDate: "", originalTime: "",
    hours: "1", minutes: "0", confirmed: true, skipped: false };
  assert.ok(missing.warnings.includes("Deadline is unclear."));
  assert.throws(() => confirmedAssignment(review, "America/Halifax", "2026-09-27T12:00:00.000Z", "assignment-2"));
  assert.throws(() => confirmedAssignment({ ...review, date: "2026-11-01", time: "01:30" }, "America/Halifax", "2026-09-27T12:00:00.000Z", "assignment-2"));
  assert.equal(confirmedAssignment({ ...review, date: "2026-10-02", time: "21:00" }, "America/Halifax", "2026-09-27T12:00:00.000Z", "assignment-2").remainingMinutes, 60);
});

test("AI configuration and provider failures return safe error codes", async () => {
  const previousToken = process.env.REPLICATE_API_TOKEN;
  const previousFetch = global.fetch;
  const request = { text, timezone: "America/Halifax", referenceDate: "2026-09-27" };
  try {
    delete process.env.REPLICATE_API_TOKEN;
    await assert.rejects(extractWithReplicate(request), { code: "unconfigured" });
    process.env.REPLICATE_API_TOKEN = "test-token";
    global.fetch = async () => new Response("unauthorized", { status: 401 });
    await assert.rejects(extractWithReplicate(request), { code: "unavailable" });
    global.fetch = async () => { throw new DOMException("timed out", "TimeoutError"); };
    await assert.rejects(extractWithReplicate(request), { code: "timeout" });
  } finally {
    if (previousToken === undefined) delete process.env.REPLICATE_API_TOKEN;
    else process.env.REPLICATE_API_TOKEN = previousToken;
    global.fetch = previousFetch;
  }
});
