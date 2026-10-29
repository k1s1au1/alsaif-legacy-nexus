import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("./model.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { nearestInDirection, tvDate, tvTime, parsePost, safeImageUrl, lineageIds, taskStage } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const rect = (x, y, w = 100, h = 60) => ({ left: x, right: x + w, top: y, bottom: y + h, width: w, height: h });

test("physical right/left remain correct when the RTL DOM order is reversed", () => {
  const rtl = [rect(240, 0), rect(120, 0), rect(0, 0), rect(240, 80), rect(120, 80), rect(0, 80)];
  assert.equal(nearestInDirection(rtl, 1, "ArrowRight"), 0);
  assert.equal(nearestInDirection(rtl, 1, "ArrowLeft"), 2);
  assert.equal(nearestInDirection(rtl, 1, "ArrowDown"), 4);
  assert.equal(nearestInDirection(rtl, 4, "ArrowUp"), 1);
  assert.equal(nearestInDirection(rtl, 0, "ArrowRight"), -1);
});

test("aligned controls beat a closer diagonal control and hidden controls are skipped", () => {
  const nodes = [rect(0, 0), rect(110, 120), rect(230, 0), rect(110, 0, 0, 0)];
  assert.equal(nearestInDirection(nodes, 0, "ArrowRight"), 2);
  assert.equal(nearestInDirection(nodes, -1, "ArrowDown"), 0);
  assert.equal(nearestInDirection([], -1, "ArrowDown"), -1);
});

test("dates use Gregorian months and Riyadh time, including UTC day rollover", () => {
  assert.match(tvDate("2026-11-06"), /نوفمبر/);
  assert.equal(tvDate("2026-11-05T22:30:00Z", { month: undefined, day: "numeric" }), new Intl.NumberFormat("ar-SA").format(6));
  assert.match(tvTime("2026-11-06", "20:00"), /م/);
  assert.equal(tvTime("2026-11-06", "20:00"), tvTime("2026-11-06T17:00:00Z"));
  assert.equal(tvDate("broken"), "الموعد يحدد لاحقًا");
  assert.equal(tvDate(), "الموعد يحدد لاحقًا");
});

test("image references keep storage paths separate from HTTPS URLs", () => {
  assert.equal(safeImageUrl("javascript:alert(1)"), "");
  assert.equal(safeImageUrl("http://example.com/a.jpg"), "");
  assert.equal(safeImageUrl("member/private.jpg"), "");
  assert.equal(safeImageUrl("https://example.com/a.jpg"), "https://example.com/a.jpg");
});

test("legacy image metadata is removed while Arabic content is preserved", () => {
  const post = parsePost("---kind:story\n---image:member/photo.jpg\nمن ذاكرة العائلة\nالنص كما كُتب");
  assert.equal(post.image, "member/photo.jpg");
  assert.equal(post.body, "من ذاكرة العائلة\nالنص كما كُتب");
  assert.equal(parsePost(null).body, "");
});

test("a malformed cyclic genealogy cannot trap TV navigation", () => {
  const rows = [{ id: "a", parent_id: "b" }, { id: "b", parent_id: "c" }, { id: "c", parent_id: "a" }];
  assert.deepEqual(lineageIds(rows, "a"), ["a", "b", "c"]);
  assert.deepEqual(lineageIds(rows, "unknown"), []);
  assert.equal(taskStage(0), "new"); assert.equal(taskStage(40), "doing"); assert.equal(taskStage(100), "done");
});
