import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/lib/rich-notification.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function("module", "exports", compiled)(module, module.exports);
const { richNotificationContent } = module.exports;

test("notification text retains the entire source, including newlines and long Arabic paragraphs", () => {
  const body = "تفاصيل المناسبة كاملة\n" + "نص طويل دون اختصار. ".repeat(70);
  assert.equal(richNotificationContent({ notification: { body } }).body, body);
});
test("includes the content image when supplied", () => {
  assert.equal(richNotificationContent({ data: { image: "https://example.test/occasion.jpg" } }).image, "https://example.test/occasion.jpg");
});
test("missing or invalid image retains the notification text", () => {
  for (const image of [undefined, "invalid", "http://example.test/image.jpg"]) {
    const result = richNotificationContent({ data: { body: "رد الرئيس", ...(image ? { image } : {}) } });
    assert.equal(result.image, undefined);
    assert.equal(result.body, "رد الرئيس");
  }
});
test("rich notification retains the exact item's destination", () => {
  const url = "/community?post=00000000-0000-4000-8000-000000000001";
  assert.equal(richNotificationContent({ data: { url } }).url, url);
});

function workerHarness() {
  const listeners = {};
  const shown = [];
  let background;
  const worker = fs.readFileSync(new URL("../public/firebase-messaging-sw.js", import.meta.url), "utf8");
  vm.runInNewContext(worker, {
    importScripts() {},
    firebase: { initializeApp() {}, messaging: () => ({ onBackgroundMessage(fn) { background = fn; } }) },
    self: {
      location: { origin: "https://app.test" },
      addEventListener(name, handler) { listeners[name] = handler; },
      registration: { showNotification(title, options) { shown.push({ title, options }); return Promise.resolve(); } },
    },
    URL,
  });
  return { background, shown };
}

test("background data-only notification displays image and complete text", async () => {
  const { background, shown } = workerHarness();
  const body = "نص المشاركة كاملاً ".repeat(50);
  await background({ data: { title: "ركن الأعضاء", body, image: "https://example.test/post.jpg" } });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].options.body, body);
  assert.equal(shown[0].options.image, "https://example.test/post.jpg");
});
test("does not duplicate a background notification already displayed by Firebase", async () => {
  const { background, shown } = workerHarness();
  await background({ notification: { title: "مناسبة", body: "تفاصيل" } });
  assert.equal(shown.length, 0);
});