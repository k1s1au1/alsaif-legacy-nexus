import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/vault-library.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", compiled)(module, module.exports);
const {
  vaultIsLocked,
  vaultSharingLabel,
  vaultFileKind,
  vaultFileError,
  vaultDate,
  filterVaultItems,
  VAULT_MAX_FILE_BYTES,
} = module.exports;

test("a timed document releases at the exact instant, including timezone offsets", () => {
  const now = Date.parse("2026-10-06T06:00:00Z");
  assert.equal(vaultIsLocked({ unlock_at: "2026-10-06T09:00:01+03:00" }, now), true);
  assert.equal(vaultIsLocked({ unlock_at: "2026-10-06T09:00:00+03:00" }, now), false);
  assert.equal(vaultIsLocked({ unlock_at: "2026-10-06T08:59:59+03:00" }, now), false);
  assert.equal(vaultIsLocked({ unlock_at: null }, now), false);
});

test("a malformed legacy release date cannot make a timed document accessible", () => {
  assert.equal(vaultIsLocked({ unlock_at: "invalid date" }), true);
  assert.equal(vaultDate("invalid date"), "");
  assert.equal(vaultDate(null), "");
  assert.match(vaultDate("2026-10-06T06:00:00Z"), /٢٠٢٦|2026/);
});

test("sharing badges reflect saved recipients and default legacy records to private", () => {
  assert.equal(vaultSharingLabel({ shared_with: ["all"] }), "العائلة");
  assert.equal(vaultSharingLabel({ shared_with: ["person-1", "person-2"] }), "أشخاص محددون");
  assert.equal(vaultSharingLabel({ shared_with: [] }), "خاص بي");
  assert.equal(vaultSharingLabel({ shared_with: null }), "خاص بي");
  assert.equal(vaultSharingLabel({}), "خاص بي");
});

test("preview type is inferred from the real file extension, not a title or URL query", () => {
  assert.equal(vaultFileKind("owner/file.PDF?token=one"), "pdf");
  assert.equal(vaultFileKind("owner/scan.HEIC"), "image");
  assert.equal(vaultFileKind("owner/photo.jpeg#page"), "image");
  assert.equal(vaultFileKind("owner/file.exe?fake=.pdf"), "other");
  assert.equal(vaultFileKind("owner/file.svg"), "other");
  assert.equal(vaultFileKind(null), "other");
});

test("upload rejects empty, oversized, and unsupported files before contacting storage", () => {
  const file = { name: "scan.pdf", type: "application/pdf", size: VAULT_MAX_FILE_BYTES };
  assert.equal(vaultFileError(file), null);
  assert.ok(vaultFileError({ ...file, size: VAULT_MAX_FILE_BYTES + 1 }));
  assert.ok(vaultFileError({ ...file, size: 0 }));
  assert.ok(vaultFileError({ ...file, name: "scan.html", type: "text/html" }));
  assert.ok(vaultFileError({ ...file, name: "scan.pdf", type: "text/html" }));
  assert.equal(vaultFileError({ name: "scan.JPEG", type: "image/jpeg", size: 400 }), null);
  assert.equal(vaultFileError({ name: "scan.heic", type: "", size: 400 }), null);
});

const documents = [
  {
    id: "will",
    title: "وصيّة الوالد",
    description: "رسالة إلى الأبناء",
    category: "will",
    uploader: { arabic_name: "أحمد" },
  },
  {
    id: "deed",
    title: "صك المنزل",
    description: null,
    category: "deed",
    uploader: { full_name: "خالد" },
  },
  { id: "old", title: "مخطوط العائلة", description: "نسخة قديمة", category: "heritage" },
];

test("Arabic search combines owner and content, ignoring vowels and alef variants", () => {
  assert.deepEqual(
    filterVaultItems(documents, "all", "وصية احمد").map((item) => item.id),
    ["will"],
  );
  assert.deepEqual(
    filterVaultItems(documents, "all", "خالد المنزل").map((item) => item.id),
    ["deed"],
  );
  assert.deepEqual(
    filterVaultItems(documents, "all", "الأبناء").map((item) => item.id),
    ["will"],
  );
});

test("search and categories preserve ordering without modifying documents", () => {
  assert.deepEqual(filterVaultItems(documents, "all", "   "), documents);
  assert.deepEqual(filterVaultItems(documents, "deed", "خالد"), [documents[1]]);
  assert.equal(filterVaultItems(documents, "will", "خالد").length, 0);
  assert.deepEqual(filterVaultItems([], "all", ""), []);
  assert.deepEqual(
    documents.map((item) => item.id),
    ["will", "deed", "old"],
  );
});
