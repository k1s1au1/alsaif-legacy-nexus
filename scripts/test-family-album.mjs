import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/family-album.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", compiled)(module, module.exports);
const {
  albumPageSize,
  albumPosition,
  albumSpread,
  albumTurnTarget,
  albumYears,
  filterAlbumItems,
  albumCaption,
  albumDate,
} = module.exports;

test("a partial last spread preserves every memory exactly once", () => {
  for (let count = 1; count <= 18; count++) {
    const items = Array.from({ length: count }, (_, i) => i);
    const { pages } = albumPosition(count, 5, 0);
    const shown = Array.from({ length: pages }, (_, page) => {
      const spread = albumSpread(items, page);
      assert.ok(spread.right.length <= 2 && spread.left.length <= 3);
      return [...spread.right, ...spread.left];
    }).flat();
    assert.deepEqual(shown, items);
  }
});

test("right advances and left returns without wrapping across book covers", () => {
  assert.equal(albumTurnTarget(0, 3, "right"), 1);
  assert.equal(albumTurnTarget(1, 3, "left"), 0);
  assert.equal(albumTurnTarget(0, 3, "left"), null);
  assert.equal(albumTurnTarget(2, 3, "right"), null);
  assert.equal(albumTurnTarget(0, 1, "right"), null);
});

test("rotation keeps the reader on the page containing their current memory", () => {
  const anchor = 10;
  assert.deepEqual(albumPosition(17, albumPageSize("book"), anchor), { page: 2, pages: 4 });
  assert.deepEqual(albumPosition(17, albumPageSize("page"), anchor), { page: 3, pages: 6 });
  assert.deepEqual(albumPosition(17, albumPageSize("phone"), anchor), { page: 3, pages: 6 });
});

test("deleting the final memory clamps pagination and empty albums remain valid", () => {
  assert.deepEqual(albumPosition(10, 5, 14), { page: 1, pages: 2 });
  assert.deepEqual(albumPosition(0, 5, 14), { page: 0, pages: 1 });
  assert.deepEqual(albumSpread([], 0), { right: [], left: [] });
});

const items = [
  {
    id: "new",
    caption: "لَمَّة العائلة",
    uploaderName: "أحمد السيف",
    created_at: "2026-04-21T12:00:00Z",
  },
  { id: "old", caption: null, uploaderName: "خالد السيف", created_at: "2024-03-02T12:00:00Z" },
  {
    id: "trip",
    caption: "رحلة العلا",
    uploaderName: "احمد السيف",
    created_at: "2026-01-14T12:00:00Z",
  },
];

test("all years is the default and year filtering doesn't reorder pinned memories", () => {
  assert.deepEqual(filterAlbumItems(items, "", "all"), items);
  assert.deepEqual(
    filterAlbumItems(items, "", "2026").map((x) => x.id),
    ["new", "trip"],
  );
  assert.deepEqual(albumYears([...items, { created_at: "invalid" }]), ["2026", "2024"]);
});

test("Arabic search matches unvowelled names and combines description with publisher", () => {
  assert.deepEqual(
    filterAlbumItems(items, "لمة احمد", "all").map((x) => x.id),
    ["new"],
  );
  assert.deepEqual(
    filterAlbumItems(items, "خالد", "2024").map((x) => x.id),
    ["old"],
  );
  assert.equal(filterAlbumItems(items, "خالد", "2026").length, 0);
});

test("uploads without captions still have meaningful labels and Gregorian dates", () => {
  assert.equal(albumCaption(items[1]), "ذكرى من خالد السيف");
  assert.equal(albumCaption({ caption: "  لقاء العائلة  ", uploaderName: "عضو" }), "لقاء العائلة");
  assert.match(albumDate(items[0].created_at), /2026/);
  assert.equal(albumDate("invalid"), "");
});
