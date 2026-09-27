/* eslint-disable @typescript-eslint/no-require-imports -- The Node runner transpiles local TypeScript with the installed compiler. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const typescript = require("typescript");

// Load the same TypeScript modules and path alias used by the browser bundle.
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

const { STORAGE_KEY, newAppState, loadDocument, saveDocument, discardStoredDocument } = require("../src/lib/persistence/storage.ts");

test("saved work survives a reload and a stale tab cannot overwrite it", () => {
  const values = new Map();
  const previousWindow = global.window;
  global.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } };
  try {
    assert.deepEqual(loadDocument(), { kind: "empty" });
    const initial = newAppState();
    const saved = { ...initial, documentRevision: 1, inputRevision: 1 };
    assert.equal(saveDocument(initial, saved, false), "saved");
    assert.equal(loadDocument().kind, "ok");
    assert.equal(loadDocument().state.documentRevision, 1);
    assert.equal(saveDocument(initial, saved, false), "stale");
    assert.equal(discardStoredDocument(), true);
    assert.equal(values.has(STORAGE_KEY), false);
  } finally {
    global.window = previousWindow;
  }
});

test("blocked browser storage fails safely without deleting in-memory work", () => {
  const previousWindow = global.window;
  global.window = { get localStorage() { throw new Error("Storage blocked"); } };
  try {
    const state = newAppState();
    assert.deepEqual(loadDocument(), { kind: "unavailable" });
    assert.equal(saveDocument(state, { ...state, documentRevision: 1 }, false), "unavailable");
    assert.equal(saveDocument(state, { ...state, documentRevision: 1 }, true), "unavailable");
    assert.equal(discardStoredDocument(), false);
  } finally {
    global.window = previousWindow;
  }
});
