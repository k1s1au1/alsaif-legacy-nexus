import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

// Load the production preference helpers; icon rendering is outside these tests.
const source = fs.readFileSync(new URL("../src/lib/navigation-registry.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const require = createRequire(import.meta.url);
const module = { exports: {} };
new Function("module", "exports", "require", compiled)(module, module.exports, (id) =>
  id === "@/components/icons/lineage-legacy-icon" ? { LineageLegacyIcon: () => null } : require(id),
);
const { normalizeBottomNavKeys, normalizeHeaderNavKeys, getStoredHeaderNavKeys, updateNavigationPreferences } = module.exports;
const member = { canAccessAdmin: false };
const admin = { canAccessAdmin: true };

test("existing bottom preferences survive without changing either default header", () => {
  const legacy = ["dashboard", "news", "finance"];
  assert.deepEqual(normalizeBottomNavKeys(legacy), legacy);
  assert.equal(getStoredHeaderNavKeys(legacy), undefined);
  assert.deepEqual(normalizeHeaderNavKeys(undefined, admin), ["calendar", "admin"]);
  assert.deepEqual(normalizeHeaderNavKeys(undefined, member), ["calendar", "chat"]);
});

test("new and malformed accounts receive usable defaults", () => {
  for (const value of [null, undefined, "broken", { bottom: false }, []]) {
    assert.deepEqual(normalizeBottomNavKeys(value), ["dashboard", "chat", "finance"]);
    assert.equal(getStoredHeaderNavKeys(value), undefined);
  }
});

test("custom header choices keep their order and use only distinct valid services", () => {
  assert.deepEqual(normalizeHeaderNavKeys(["news", "trips"], member), ["news", "trips"]);
  assert.deepEqual(normalizeHeaderNavKeys(["dashboard", "heritage", "news", "news", false], member), ["news", "calendar"]);
});

test("revoking administration access removes a previously saved Admin shortcut", () => {
  const saved = ["calendar", "admin"];
  assert.deepEqual(normalizeHeaderNavKeys(saved, admin), saved);
  assert.deepEqual(normalizeHeaderNavKeys(saved, member), ["calendar", "chat"]);
  assert.deepEqual(normalizeHeaderNavKeys(["admin", "news"], member), ["news", "calendar"]);
});

test("guests see only allowed or public destinations", () => {
  const guest = { canAccessAdmin: false, isGuest: true, allowedSections: ["news"] };
  assert.deepEqual(normalizeHeaderNavKeys(["admin", "news"], guest), ["news", "members"]);
  assert.deepEqual(normalizeHeaderNavKeys(undefined, { ...guest, allowedSections: ["calendar", "chat"] }), ["calendar", "chat"]);
});

test("saving the header preserves existing bottom shortcuts", () => {
  const saved = updateNavigationPreferences(["dashboard", "trips", "tasks"], { header: ["news", "chat"] });
  assert.deepEqual(normalizeBottomNavKeys(saved), ["dashboard", "trips", "tasks"]);
  assert.deepEqual(getStoredHeaderNavKeys(saved), ["news", "chat"]);
});

test("saving the bottom bar preserves header shortcuts, including after serialization", () => {
  const current = JSON.parse(JSON.stringify(updateNavigationPreferences(null, { header: ["calendar", "admin"] })));
  const saved = updateNavigationPreferences(current, { bottom: ["dashboard", "meetings", "trips"] });
  assert.deepEqual(getStoredHeaderNavKeys(saved), ["calendar", "admin"]);
  assert.deepEqual(normalizeBottomNavKeys(saved), ["dashboard", "meetings", "trips"]);
});

test("restoring header defaults retains bottom choices and follows future permission changes", () => {
  const current = { v: 1, bottom: ["dashboard", "news", "vault"], header: ["trips", "chat"] };
  const reset = updateNavigationPreferences(current, { header: null });
  assert.deepEqual(normalizeBottomNavKeys(reset), current.bottom);
  assert.equal(getStoredHeaderNavKeys(reset), undefined);
  assert.deepEqual(normalizeHeaderNavKeys(getStoredHeaderNavKeys(reset), member), ["calendar", "chat"]);
  assert.deepEqual(normalizeHeaderNavKeys(getStoredHeaderNavKeys(reset), admin), ["calendar", "admin"]);
});

test("bottom updates retain the legacy format until a header is customized", () => {
  assert.deepEqual(updateNavigationPreferences(null, { bottom: ["dashboard", "archive", "profile"] }), ["dashboard", "archive", "profile"]);
});
