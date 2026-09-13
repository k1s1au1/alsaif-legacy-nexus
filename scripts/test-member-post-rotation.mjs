import assert from "node:assert/strict";
import test from "node:test";
import { MEMBER_POST_PREVIEW_SIZE, MEMBER_POST_ROTATION_MS, PUBLIC_MEMBER_POST_KINDS, sampleMemberPostOffsets } from "../src/lib/member-post-rotation.ts";

function seededRandom(seed = 42) {
  let value = seed;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

test("only three public posts, with a one-minute interval", () => {
  assert.equal(MEMBER_POST_PREVIEW_SIZE, 3);
  assert.equal(MEMBER_POST_ROTATION_MS, 60_000);
  assert.deepEqual(PUBLIC_MEMBER_POST_KINDS, ["diary", "question", "photo"]);
  assert.ok(!PUBLIC_MEMBER_POST_KINDS.includes("request"));
});

test("empty, invalid and small corners", () => {
  for (const count of [0, -1, NaN, Infinity, 1.5]) assert.deepEqual(sampleMemberPostOffsets(count), []);
  for (const count of [1, 2, 3]) {
    const result = sampleMemberPostOffsets(count, [], seededRandom());
    assert.equal(result.length, count);
    assert.equal(new Set(result).size, count);
    assert.deepEqual([...result].sort((a, b) => a - b), Array.from({ length: count }, (_, i) => i));
  }
});

test("random rotation avoids the previous group when possible", () => {
  const random = seededRandom();
  for (const count of [6, 20, 128, 1000, 1_000_000]) {
    let previous = [];
    for (let turn = 0; turn < 100; turn += 1) {
      const next = sampleMemberPostOffsets(count, previous, random);
      assert.equal(next.length, 3);
      assert.equal(new Set(next).size, 3);
      assert.ok(next.every((offset) => offset >= 0 && offset < count));
      assert.ok(next.every((offset) => !previous.includes(offset)));
      previous = next;
    }
  }
});

test("four or five posts retain only unavoidable overlap", () => {
  const random = seededRandom();
  for (const count of [4, 5]) {
    let previous = sampleMemberPostOffsets(count, [], random);
    for (let turn = 0; turn < 100; turn += 1) {
      const next = sampleMemberPostOffsets(count, previous, random);
      assert.equal(new Set(next).size, 3);
      assert.equal(next.filter((offset) => previous.includes(offset)).length, 6 - count);
      previous = next;
    }
  }
});

test("constant random values and changing counts never hang or duplicate", () => {
  for (const random of [() => 0, () => 1]) {
    for (const count of [3, 4, 5, 6, 128]) {
      const next = sampleMemberPostOffsets(count, [0, 0, 2, -5, 9999], random);
      assert.equal(next.length, 3);
      assert.equal(new Set(next).size, 3);
      assert.ok(next.every((offset) => offset >= 0 && offset < count));
    }
  }
});

test("older posts are eligible, not just the latest page", () => {
  const random = seededRandom();
  const seen = new Set();
  let previous = [];
  for (let turn = 0; turn < 1000; turn += 1) {
    previous = sampleMemberPostOffsets(128, previous, random);
    previous.forEach((offset) => seen.add(offset));
  }
  assert.equal(seen.size, 128);
});
