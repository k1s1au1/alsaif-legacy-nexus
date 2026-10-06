import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

function loadModule(
  path,
  require = () => {
    throw new Error("Unexpected import");
  },
) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", compiled)(module, module.exports, require);
  return module.exports;
}
const album = loadModule("../src/lib/family-album.ts");
const { uploadAlbumMemories } = loadModule("../src/lib/family-album-upload.ts", (path) => {
  assert.equal(path, "./family-album");
  return album;
});
const customId = "0f1932f6-2b36-447a-bb93-207d5446ef94";
const customKey = `custom:${customId}`;
const member = { userId: "member", roles: ["member"], sectionHeads: [] };
const item = { uploader_id: "another", section: "family", album_id: customId };

test("creating an album is reserved for its section head, chairman and deputy", () => {
  for (const role of ["chairman", "vice_chairman"])
    assert.equal(album.canCreateFamilyAlbums({ ...member, roles: [role] }), true);
  assert.equal(album.canCreateFamilyAlbums({ ...member, sectionHeads: ["archive"] }), true);
  for (const role of ["member", "guest", "technical_admin", "admin", "manager"])
    assert.equal(album.canCreateFamilyAlbums({ ...member, roles: [role] }), false);
  assert.equal(album.canCreateFamilyAlbums({ ...member, sectionHeads: ["meetings"] }), false);
  assert.equal(
    album.canCreateFamilyAlbums({ ...member, userId: null, roles: ["chairman"] }),
    false,
  );
});

test("members add to shared albums while official sections retain their responsibilities", () => {
  assert.equal(album.canUploadToAlbum(member, customKey), true);
  assert.equal(album.canUploadToAlbum(member, "family"), true);
  for (const key of ["meetings", "events", "trips"])
    assert.equal(album.canUploadToAlbum(member, key), false);
  assert.equal(album.canUploadToAlbum({ ...member, sectionHeads: ["occasions"] }, "events"), true);
  assert.equal(album.canUploadToAlbum({ ...member, sectionHeads: ["meetings"] }, "trips"), false);
  assert.equal(album.canUploadToAlbum({ ...member, roles: [] }, customKey), false);
  assert.equal(album.canManageAlbumItem(member, item), false);
  assert.equal(album.canManageAlbumItem(member, { ...item, uploader_id: "member" }), true);
  assert.equal(album.canManageAlbumItem({ ...member, sectionHeads: ["archive"] }, item), true);
});

test("custom photos stay outside the daily family album and unknown destinations fail", () => {
  assert.equal(album.albumItemKey(item), customKey);
  assert.equal(album.albumItemKey({ section: "family" }), "family");
  assert.deepEqual(album.albumDestination(customKey), { section: "family", album_id: customId });
  assert.deepEqual(album.albumDestination("events"), { section: "events", album_id: null });
  for (const key of ["custom:", "custom:bad-id", "finance", "fake:" + customId])
    assert.throws(() => album.albumDestination(key));
});

test("names reject duplicates, empty titles and overlong Arabic names", () => {
  assert.equal(album.albumNameError(" ذكريات الصيف ", []), null);
  assert.ok(album.albumNameError("ذكريات  الصيف", ["ذكريات الصيف"]));
  assert.ok(album.albumNameError("  ", []));
  assert.ok(album.albumNameError("ذ".repeat(61), []));
  assert.equal(album.albumNameError("ذ".repeat(60), []), null);
});

test("media validation accepts the size boundary and rejects zero byte or unsupported files", () => {
  assert.equal(album.albumMediaError({ type: "video/mp4", size: album.ALBUM_MAX_BYTES }), null);
  assert.ok(album.albumMediaError({ type: "image/png", size: album.ALBUM_MAX_BYTES + 1 }));
  assert.ok(album.albumMediaError({ type: "image/png", size: 0 }));
  assert.ok(album.albumMediaError({ type: "application/pdf", size: 500 }));
});

const photo = (name = "photo.png") => new File(["image"], name, { type: "image/png" });
function ports(overrides = {}) {
  const records = [],
    removed = [],
    uploaded = [],
    progress = [];
  return {
    records,
    removed,
    uploaded,
    progress,
    api: {
      upload: async (path, file) => {
        uploaded.push({ path, file });
      },
      insert: async (row) => {
        records.push(row);
      },
      remove: async (path) => {
        removed.push(path);
      },
      onProgress: (...values) => progress.push(values),
      ...overrides,
    },
  };
}

test("uploads snapshot the chosen album and caption before a long batch", async () => {
  const a = photo("a.png"),
    b = photo("b.png");
  const input = { album: customKey, files: [a, b], caption: "  رحلة جميلة  " };
  const p = ports();
  p.api.upload = async () => {
    input.album = "meetings";
    input.caption = "changed";
    input.files.pop();
  };
  const result = await uploadAlbumMemories("member", input, p.api);
  assert.deepEqual(result.uploaded, [a, b]);
  assert.deepEqual(result.errors, []);
  assert.equal(p.records.length, 2);
  for (const row of p.records) {
    assert.equal(row.album_id, customId);
    assert.equal(row.section, "family");
    assert.equal(row.caption, "رحلة جميلة");
    assert.equal(row.uploader_id, "member");
    assert.match(row.storage_path, /^member\/[\da-f-]+\.png$/);
  }
  assert.deepEqual(p.progress, [
    [1, 2],
    [2, 2],
  ]);
});

test("partial failure retains only failed files for retry and cleans storage after rejected metadata", async () => {
  const good = photo("good.png"),
    failed = photo("failed.png");
  const p = ports();
  let insertCount = 0;
  p.api.insert = async (row) => {
    if (++insertCount === 2) throw new Error("RLS denied");
    p.records.push(row);
  };
  const result = await uploadAlbumMemories(
    "member",
    { files: [good, failed], album: customKey, caption: "" },
    p.api,
  );
  assert.deepEqual(result.uploaded, [good]);
  assert.equal(result.errors[0].file, failed);
  assert.deepEqual(p.removed, [p.uploaded[1].path]);
  const retry = await uploadAlbumMemories(
    "member",
    { files: result.errors.map((e) => e.file), album: customKey, caption: "" },
    p.api,
  );
  assert.deepEqual(retry.uploaded, [failed]);
  assert.equal(p.records.length, 2);
  assert.equal(p.records[0].caption, null);
});

test("a failed storage upload and an invalid file never insert a memory or report success", async () => {
  const file = photo(),
    invalid = new File(["pdf"], "file.pdf", { type: "application/pdf" });
  const p = ports({
    upload: async () => {
      throw new Error("Offline");
    },
  });
  const result = await uploadAlbumMemories(
    "member",
    { files: [file, invalid], album: "family", caption: "" },
    p.api,
  );
  assert.equal(result.uploaded.length, 0);
  assert.equal(result.errors.length, 2);
  assert.equal(p.records.length, 0);
  assert.equal(p.removed.length, 0);
});
