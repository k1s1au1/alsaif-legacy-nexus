import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const temp = mkdtempSync(path.join(tmpdir(), "uno-rules-"));
writeFileSync(path.join(temp, "package.json"), '{"type":"module"}');
const source = readFileSync(
  new URL("../src/components/entertainment/uno-engine.ts", import.meta.url),
  "utf8",
);
writeFileSync(
  path.join(temp, "uno.js"),
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText,
);
const {
  initialUnoData,
  reduceUno,
  rematchUno,
  getUnoParticipants,
  sortUnoHand,
  unoPlayable,
  UNO_TURN_MS,
} = await import(pathToFileURL(path.join(temp, "uno.js")));
after(() => rmSync(temp, { recursive: true, force: true }));
const players = ["خالد", "عمر", "نورة", "عبدالله"].map((name, i) => ({
  id: "p" + i,
  name,
  avatarUrl: null,
  joinedAt: 100 + i,
  ready: true,
}));
const card = (id, color, value) => ({ id, color, value });
const start = (mode = "classic") => ({
  phase: "playing",
  round: 0,
  scores: {},
  data: initialUnoData(players, 0, mode, 1000),
});
const apply = (s, type, value = {}, now = 2000) =>
  reduceUno(
    s,
    {
      type,
      playerId: players[s.data.turnIndex].id,
      value: { ...value, turnSequence: s.data.turnSequence },
    },
    players,
    now,
  );
function configured(mode = "classic") {
  const s = start(mode);
  s.data.currentColor = "red";
  s.data.discard = [card("top", "red", "5")];
  s.data.hands.p0 = [card("r5", "red", "5"), card("b8", "blue", "8"), card("g3", "green", "3")];
  return s;
}
function timeout(s, now = s.data.turnDeadline) {
  return {
    type: "uno-timeout",
    playerId: players[s.data.turnIndex].id,
    value: { turnSequence: s.data.turnSequence, deadline: s.data.turnDeadline },
    now,
  };
}

test("all three existing modes deal seven cards and one canonical roster", () => {
  for (const mode of ["classic", "flip", "no-mercy"]) {
    const s = start(mode);
    assert.equal(s.data.turnDeadline, 1000 + UNO_TURN_MS);
    assert.deepEqual(s.data.roster, players);
    assert.equal(
      new Set(
        [...Object.values(s.data.hands).flat(), ...s.data.drawPile, ...s.data.discard].map(
          (c) => c.id,
        ),
      ).size,
      mode === "classic" ? 108 : mode === "flip" ? 124 : 124,
    );
    assert.ok(Object.values(s.data.hands).every((h) => h.length === 7));
  }
});
test("sorting is local, stable and preserves every card and the shared hand", () => {
  const hand = [
    card("b9", "blue", "9"),
    card("r8", "red", "8"),
    card("r1", "red", "1"),
    card("w", "wild", "wild"),
    card("y1", "yellow", "1"),
  ];
  const copy = structuredClone(hand);
  assert.deepEqual(
    sortUnoHand(hand, "color").map((c) => c.id),
    ["r1", "r8", "b9", "y1", "w"],
  );
  assert.deepEqual(
    sortUnoHand(hand, "value").map((c) => c.id),
    ["r1", "y1", "r8", "b9", "w"],
  );
  assert.deepEqual(sortUnoHand(hand, "original"), copy);
  assert.deepEqual(hand, copy);
});
test("expiry transfers the turn without adding cards, awarding a win or mutating snapshots", () => {
  const s = configured();
  const before = structuredClone(s);
  const a = timeout(s);
  const next = reduceUno(s, a, players, a.now);
  assert.equal(next.data.turnIndex, 1);
  assert.deepEqual(next.data.hands, s.data.hands);
  assert.deepEqual(next.scores, s.scores);
  assert.equal(next.data.turnDeadline, a.now + UNO_TURN_MS);
  assert.equal(next.data.turnSequence, 2);
  assert.deepEqual(s, before);
  assert.match(next.data.lastAction, /انتهى وقت خالد/);
});
test("early, duplicated and stale timeout packets cannot skip extra seats", () => {
  const s = configured();
  const a = timeout(s);
  assert.equal(reduceUno(s, a, players, a.now - 1), s);
  const next = reduceUno(s, a, players, a.now);
  assert.equal(reduceUno(next, a, players, a.now + 1), next);
  const stale = { ...a, playerId: "p1" };
  assert.equal(reduceUno(next, stale, players, a.now + 1), next);
});
test("a late play expires the old turn instead of consuming the card", () => {
  const s = configured();
  const next = apply(s, "uno-play", { cardId: "r5" }, s.data.turnDeadline);
  assert.equal(next.data.turnIndex, 1);
  assert.deepEqual(next.data.hands, s.data.hands);
  assert.equal(next.data.discard.length, 1);
});
test("a playable drawn card can be played before the original deadline", () => {
  const s = configured();
  s.data.drawPile.unshift(card("drawn", "red", "7"));
  const drawn = apply(s, "uno-draw", {}, 10000);
  assert.equal(drawn.data.turnIndex, 0);
  assert.equal(drawn.data.turnDeadline, s.data.turnDeadline);
  assert.equal(drawn.data.drawnCardId, "drawn");
  assert.equal(apply(drawn, "uno-play", { cardId: "r5" }, 11000), drawn);
  const played = apply(drawn, "uno-play", { cardId: "drawn" }, 11000);
  assert.equal(played.data.discard.at(-1).id, "drawn");
  assert.equal(played.data.turnIndex, 1);
  assert.equal(played.data.turnDeadline, 11000 + UNO_TURN_MS);
});
test("drawing does not reset the timer; a drawn card can be passed or expire", () => {
  const s = configured();
  const drawn = apply(s, "uno-draw");
  const passed = apply(drawn, "uno-pass");
  assert.equal(passed.data.turnIndex, 1);
  assert.equal(passed.data.drawnCardId, null);
  const a = timeout(drawn);
  const next = reduceUno(drawn, a, players, a.now);
  assert.equal(next.data.turnIndex, 1);
  assert.equal(next.data.drawnCardId, null);
  assert.deepEqual(next.data.hands, drawn.data.hands);
});
test("reconnection preserves seats, turn and hand when presence order changes or a player disappears", () => {
  const s = configured();
  const order = getUnoParticipants(s.data, [
    { ...players[3], joinedAt: 900 },
    players[0],
    { ...players[1], joinedAt: 800 },
  ]);
  assert.deepEqual(
    order.map((p) => p.id),
    players.map((p) => p.id),
  );
  assert.equal(order[2].connected, false);
  assert.equal(order[1].joinedAt, 101);
  const reconnect = getUnoParticipants(
    s.data,
    players
      .slice()
      .reverse()
      .map((p) => ({ ...p, joinedAt: 990 })),
  );
  assert.deepEqual(
    reconnect.map((p) => p.id),
    players.map((p) => p.id),
  );
  assert.ok(reconnect.every((p) => p.connected));
  const next = reduceUno(
    s,
    { type: "uno-play", playerId: "p0", value: { cardId: "r5", turnSequence: 1 } },
    order,
    2000,
  );
  assert.equal(next.data.turnIndex, 1);
  assert.deepEqual(next.data.hands.p2, s.data.hands.p2);
});
test("one rematch retains session wins, mode, bots and seat identities", () => {
  const s = configured("flip");
  s.phase = "results";
  s.scores = { p0: 2, p2: 1 };
  s.data.winnerId = "p0";
  s.bots = [{ ...players[3], isBot: true }];
  const next = rematchUno(s, players, 40000);
  assert.equal(next.phase, "playing");
  assert.equal(next.round, 1);
  assert.deepEqual(next.scores, s.scores);
  assert.deepEqual(next.bots, s.bots);
  assert.deepEqual(next.data.roster, s.data.roster);
  assert.equal(next.data.mode, "flip");
  assert.equal(next.data.winnerId, null);
  assert.ok(Object.values(next.data.hands).every((h) => h.length === 7));
  assert.equal(rematchUno(next, players), next);
});
test("winner score is added exactly once, including discard-all", () => {
  for (const value of ["5", "discardAll"]) {
    const s = configured("no-mercy");
    s.data.hands.p0 = [card("winning", "red", value)];
    const won = apply(s, "uno-play", { cardId: "winning" });
    assert.equal(won.phase, "results");
    assert.equal(won.scores.p0, 1);
    assert.equal(apply(won, "uno-play", { cardId: "winning" }), won);
  }
});
test("reverse and skip grant a fresh clock even when a two-player turn returns to the same person", () => {
  for (const value of ["reverse", "skip"]) {
    const two = players.slice(0, 2);
    const s = configured();
    s.data.roster = two;
    s.data.hands.p0 = [card("special", "red", value), card("other", "blue", "8")];
    const next = reduceUno(
      s,
      { type: "uno-play", playerId: "p0", value: { cardId: "special", turnSequence: 1 } },
      two,
      5000,
    );
    assert.equal(next.data.turnIndex, 0);
    assert.equal(next.data.turnSequence, 2);
    assert.equal(next.data.turnDeadline, 5000 + UNO_TURN_MS);
    assert.equal(
      reduceUno(
        next,
        { type: "uno-play", playerId: "p0", value: { cardId: "other", turnSequence: 1 } },
        two,
        6000,
      ),
      next,
    );
  }
});
test("no-mercy draw stacking keeps its existing rules and starts the next timer", () => {
  const s = configured("no-mercy");
  s.data.hands.p0 = [card("draw2", "red", "draw2"), card("other", "blue", "1")];
  const next = apply(s, "uno-play", { cardId: "draw2" });
  assert.equal(next.data.pendingDraw, 2);
  assert.equal(next.data.turnIndex, 1);
  const drawn = apply(next, "uno-draw", {}, 3000);
  assert.equal(drawn.data.pendingDraw, 0);
  assert.equal(drawn.data.hands.p1.length, 9);
  assert.equal(drawn.data.turnIndex, 2);
  assert.equal(drawn.data.turnDeadline, 3000 + UNO_TURN_MS);
});
test("legacy saved rounds get a clock once without redealing or reordering", () => {
  const s = configured();
  delete s.data.turnDeadline;
  delete s.data.turnSequence;
  delete s.data.roster;
  const next = reduceUno(s, { type: "uno-clock", playerId: "p0" }, players, 5000);
  assert.deepEqual(next.data.hands, s.data.hands);
  assert.equal(next.data.turnDeadline, 35000);
  assert.equal(reduceUno(next, { type: "uno-clock", playerId: "p0" }, players, 6000), next);
});
