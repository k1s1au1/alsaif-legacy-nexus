import assert from "node:assert/strict";
import test from "node:test";
import {
  carouselIndicators,
  carouselSwipeStep,
  memberPostImages,
  moveCarousel,
  resolveCarouselIndex,
} from "../src/lib/member-post-carousel.ts";

test("realtime reordering retains the visible photo; removal selects a valid neighbor", () => {
  const selected = { index: 2, url: "/c.png" };
  assert.equal(resolveCarouselIndex(["/c.png", "/a.png", "/b.png"], selected), 0);
  assert.equal(resolveCarouselIndex(["/a.png", "/b.png"], selected), 1);
  assert.equal(resolveCarouselIndex([], selected), 0);
  assert.equal(resolveCarouselIndex(["/a.png"], { index: -1, url: null }), 0);
  assert.equal(resolveCarouselIndex(["/a.png", "/a.png"], { index: 1, url: "/a.png" }), 1);
});

test("both RTL directions wrap at the ends, including a single photo", () => {
  assert.equal(moveCarousel(0, -1, 12), 11);
  assert.equal(moveCarousel(11, 1, 12), 0);
  assert.equal(moveCarousel(0, 1, 1), 0);
  assert.equal(moveCarousel(0, -1, 0), 0);
});

test("an arbitrarily large gallery keeps at most seven indicators with the active image", () => {
  for (const count of [0, 1, 4, 12, 40, 10_000]) {
    for (const active of [0, Math.floor(count / 2), Math.max(0, count - 1)]) {
      const indicators = carouselIndicators(count, active);
      assert.equal(indicators.length, Math.min(count, 7));
      assert.equal(new Set(indicators).size, indicators.length);
      assert.ok(indicators.every((index) => index >= 0 && index < count));
      if (count) assert.ok(indicators.includes(active));
    }
  }
});

test("vertical scrolling, diagonal movement and taps cannot turn a photo", () => {
  for (const [dx, dy] of [
    [0, 90],
    [30, 0],
    [65, 60],
    [-20, -70],
    [41, 0],
  ])
    assert.equal(carouselSwipeStep(dx, dy), 0);
  assert.equal(carouselSwipeStep(80, 12), 1);
  assert.equal(carouselSwipeStep(-80, -12), -1);
});

test("empty and invalid legacy media values cannot create unsafe viewer links", () => {
  assert.deepEqual(memberPostImages(null), []);
  assert.deepEqual(
    memberPostImages([
      null,
      5,
      "",
      "javascript:alert(1)",
      "//example.com/a.png",
      "/photo.png",
      "https://example.com/photo.png?token=abc",
    ]),
    ["/photo.png", "https://example.com/photo.png?token=abc"],
  );
});
