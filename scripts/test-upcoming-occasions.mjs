import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const modules = new Map();
function loadModule(name) {
  if (modules.has(name)) return modules.get(name);
  const source = fs.readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", compiled)(module, module.exports, (id) =>
    loadModule(id.replace(/^\.\//, "")),
  );
  modules.set(name, module.exports);
  return module.exports;
}

const { selectUpcomingOccasions, occasionDateTime } = loadModule("upcoming-occasions");
const now = new Date(2026, 9, 6, 18, 0);

test("both saved undated occasions remain in quick follow-up alongside dated items", () => {
  const rows = [
    { id: "no-date-or-time", date: "", time: "" },
    { id: "time-only", date: "", time: "11:42" },
    { id: "future", date: "2026-12-30", time: "20:00" },
    { id: "past", date: "2026-10-05" },
    { id: "today", date: "2026-10-06", time: "10:00" },
  ];
  assert.deepEqual(selectUpcomingOccasions(rows, now).map((row) => row.id), [
    "today", "future", "no-date-or-time", "time-only",
  ]);
});

test("an undated occasion has no invented date or countdown even if a time was entered", () => {
  assert.equal(occasionDateTime({ id: "one", date: "", time: "11:42" }), null);
  assert.equal(occasionDateTime({ id: "two" }), null);
  assert.equal(occasionDateTime({ id: "three", date: null }), null);
});

test("today's occasion stays visible through the end of its local day", () => {
  const rows = [{ id: "morning", date: "2026-10-06", time: "08:00" }];
  assert.equal(selectUpcomingOccasions(rows, new Date(2026, 9, 6, 23, 59, 59)).length, 1);
  assert.equal(selectUpcomingOccasions(rows, new Date(2026, 9, 7)).length, 0);
});

test("upcoming dates and times sort before undated cards", () => {
  const rows = [
    { id: "undated", date: "" },
    { id: "late", date: "2026-10-07", time: "20:00" },
    { id: "early", date: "2026-10-07", time: "08:00" },
    { id: "no-time", date: "2026-10-07", time: "" },
  ];
  assert.deepEqual(selectUpcomingOccasions(rows, now).map((row) => row.id), [
    "early", "late", "no-time", "undated",
  ]);
});

test("the shared selection excludes missing IDs without discarding unscheduled records", () => {
  assert.deepEqual(selectUpcomingOccasions([
    { id: "", date: "2026-10-07" },
    { id: "valid", date: "" },
  ], now).map((row) => row.id), ["valid"]);
});

test("selection preserves each server-authorized record and does not mutate cached data", () => {
  const rows = Object.freeze([
    Object.freeze({ id: "undated", date: "", visibility: "private", canEdit: false }),
    Object.freeze({ id: "dated", date: "2026-10-07", visibility: "official", canEdit: true }),
  ]);
  const result = selectUpcomingOccasions(rows, now);
  assert.deepEqual(rows.map((row) => row.id), ["undated", "dated"]);
  assert.strictEqual(result[1], rows[0]);
  assert.strictEqual(result[0], rows[1]);
});
