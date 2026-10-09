import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const temp = mkdtempSync(path.join(tmpdir(), "deal-rules-"));
writeFileSync(path.join(temp, "package.json"), '{"type":"module"}');
writeFileSync(
  path.join(temp, "deal.js"),
  ts.transpileModule(
    readFileSync(
      new URL("../src/components/entertainment/saudi-deal-engine.ts", import.meta.url),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
  ).outputText,
);
const {
  DEAL_GROUPS,
  DEAL_TURN_MS,
  initialDealData,
  reduceDeal,
  rematchDeal,
  getDealParticipants,
  completedDealSets,
  legalDealProperties,
  dealRent,
} = await import(pathToFileURL(path.join(temp, "deal.js")));
after(() => rmSync(temp, { recursive: true, force: true }));
const players = ["خالد", "عمر", "نورة", "عبدالله"].map((name, i) => ({
  id: `p${i}`,
  name,
  avatarUrl: null,
  joinedAt: 100 + i,
  ready: true,
}));
const land = (id, group = "najd") => ({
  id,
  type: "property",
  label: id,
  group,
  value: Math.max(1, DEAL_GROUPS.find((g) => g.id === group).size - 1),
});
const money = (id, value = 2) => ({ id, type: "money", label: `${value} مليون`, value });
const action = (id, type) => ({ id, type: "action", label: type, action: type, value: 3 });
const start = () => ({
  phase: "playing",
  round: 0,
  scores: {},
  bots: [],
  data: initialDealData(players, 0, 1000),
});
const apply = (s, type, value = {}, now = 2000) =>
  reduceDeal(
    s,
    {
      type,
      playerId: players[s.data.turnIndex].id,
      value: { ...value, turnSequence: s.data.turnSequence, round: s.round },
    },
    players,
    now,
  );
function configured(cards = []) {
  const s = start();
  s.data.needsDraw = false;
  s.data.hands.p0 = cards;
  // Attack scenarios opt into shields explicitly instead of inheriting shuffled hands.
  for (const p of players.slice(1)) s.data.hands[p.id] = [money(`${p.id}-private`)];
  return s;
}
const ids = (s) =>
  [
    ...Object.values(s.data.hands).flat(),
    ...Object.values(s.data.properties).flat(),
    ...Object.values(s.data.banks).flat(),
    ...s.data.drawPile,
    ...s.data.discard,
  ]
    .map((c) => c.id)
    .sort();
function timeout(s, now = s.data.turnDeadline) {
  return reduceDeal(
    s,
    {
      type: "deal-timeout",
      playerId: players[s.data.turnIndex].id,
      value: { turnSequence: s.data.turnSequence, deadline: s.data.turnDeadline, round: s.round },
    },
    players,
    now,
  );
}

test("unchanged deck deals five cards, records stable seats, and starts one 90-second clock", () => {
  const s = start();
  assert.equal(DEAL_TURN_MS, 90_000);
  assert.equal(s.data.turnDeadline, 91_000);
  assert.deepEqual(s.data.roster, players);
  assert.ok(Object.values(s.data.hands).every((h) => h.length === 5));
  assert.equal(ids(s).length, 91);
  assert.equal(new Set(ids(s)).size, 91);
});
test("start-of-turn draw is once, costs no action, and never renews the clock", () => {
  const s = start(),
    before = structuredClone(s);
  const n = apply(s, "deal-draw", {}, 8000);
  assert.equal(n.data.hands.p0.length, 7);
  assert.equal(n.data.actionsLeft, 3);
  assert.equal(n.data.turnDeadline, s.data.turnDeadline);
  assert.equal(apply(n, "deal-draw"), n);
  assert.deepEqual(ids(n), ids(s));
  assert.deepEqual(s, before);
  assert.equal(n.data.event.drawnCount, 2);
  assert.ok(!("cards" in n.data.event));
  const empty = start();
  empty.data.hands.p0 = [];
  assert.equal(apply(empty, "deal-draw").data.hands.p0.length, 5);
});
test("property, banking and draw action all share the original turn deadline", () => {
  const s = configured([land("l"), money("m"), action("a", "draw2"), money("keep")]);
  let n = apply(s, "deal-property", { cardId: "l" }, 10000);
  assert.equal(n.data.turnDeadline, 91000);
  n = apply(n, "deal-action", { cardId: "a" }, 20000);
  assert.equal(n.data.turnDeadline, 91000);
  assert.equal(n.data.actionsLeft, 1);
  n = apply(n, "deal-bank", { cardId: "m" }, 30000);
  assert.equal(n.data.turnIndex, 1);
  assert.equal(n.data.turnDeadline, 120000);
  assert.equal(n.data.turnSequence, 2);
});
test("manual end with excess waits for chosen discards within the original time", () => {
  const s = configured(Array.from({ length: 9 }, (_, i) => money(`m${i}`)));
  let n = apply(s, "deal-end", {}, 10000);
  assert.equal(n.data.turnIndex, 0);
  assert.equal(n.data.endingTurn, true);
  assert.equal(n.data.actionsLeft, 0);
  assert.equal(n.data.turnDeadline, 91000);
  assert.equal(apply(n, "deal-bank", { cardId: "m0" }), n);
  n = apply(n, "deal-discard", { cardId: "m1" }, 20000);
  assert.equal(n.data.turnIndex, 0);
  n = apply(n, "deal-discard", { cardId: "m8" }, 30000);
  assert.equal(n.data.turnIndex, 1);
  assert.equal(n.data.hands.p0.length, 7);
  assert.equal(n.data.turnDeadline, 120000);
});
test("third action cannot bypass the seven-card hand limit", () => {
  const s = configured([
    action("a", "draw2"),
    ...Array.from({ length: 7 }, (_, i) => money(`m${i}`)),
  ]);
  s.data.actionsLeft = 1;
  const n = apply(s, "deal-action", { cardId: "a" });
  assert.equal(n.data.endingTurn, true);
  assert.equal(n.data.turnIndex, 0);
  assert.equal(n.data.hands.p0.length, 9);
  assert.equal(n.data.turnDeadline, s.data.turnDeadline);
});
test("expiry discards newest excess once and advances without redealing or scoring", () => {
  const s = configured(Array.from({ length: 10 }, (_, i) => money(`m${i}`))),
    before = structuredClone(s);
  const n = timeout(s);
  assert.deepEqual(
    n.data.hands.p0.map((c) => c.id),
    ["m0", "m1", "m2", "m3", "m4", "m5", "m6"],
  );
  assert.deepEqual(
    n.data.discard.slice(-3).map((c) => c.id),
    ["m7", "m8", "m9"],
  );
  assert.equal(n.data.turnIndex, 1);
  assert.equal(n.data.event.discardedCount, 3);
  assert.deepEqual(n.scores, s.scores);
  assert.deepEqual(ids(n), ids(s));
  assert.deepEqual(s, before);
  assert.equal(timeout(s, 90999), s);
  assert.equal(
    reduceDeal(
      n,
      { type: "deal-timeout", playerId: "p1", value: { deadline: 91000, turnSequence: 1 } },
      players,
      200000,
    ),
    n,
  );
});
test("late inputs expire the seat, and stale packets cannot affect a later turn or round", () => {
  const s = configured([land("l")]);
  const n = apply(s, "deal-property", { cardId: "l" }, 91000);
  assert.equal(n.data.turnIndex, 1);
  assert.deepEqual(n.data.hands.p0, s.data.hands.p0);
  assert.deepEqual(n.data.properties.p0, []);
  assert.equal(
    reduceDeal(
      n,
      { type: "deal-end", playerId: "p1", value: { turnSequence: 1, round: 0 } },
      players,
      92000,
    ),
    n,
  );
  assert.equal(
    reduceDeal(
      s,
      { type: "deal-end", playerId: "p0", value: { turnSequence: 1, round: -1 } },
      players,
    ),
    s,
  );
});
test("legal targeting rejects self, unknown players, protected lands and invalid offers without consuming cards", () => {
  const s = configured([action("a", "forced_swap"), action("b", "steal"), action("c", "debt")]);
  s.data.properties.p0 = [land("own1"), land("own2")];
  s.data.properties.p1 = [land("l1", "hijaz")];
  s.data.properties.p2 = [land("x1"), land("x2")];
  for (const value of [
    { cardId: "a", targetId: "p1", propertyId: "l1", ownPropertyId: "own1" },
    { cardId: "b", targetId: "p2", propertyId: "x1" },
    { cardId: "c", targetId: "p0" },
    { cardId: "c", targetId: "stranger" },
  ])
    assert.equal(apply(s, "deal-action", value), s);
  assert.equal(apply(s, "deal-bank", { cardId: "own1" }), s);
  assert.deepEqual(legalDealProperties(s.data, "p2", "steal"), []);
});
test("swap uses the explicitly chosen own land and records both public transfers", () => {
  const s = configured([action("a", "forced_swap")]);
  s.data.properties.p0 = [land("keep"), land("offer", "sharqiya")];
  s.data.properties.p1 = [land("take", "hijaz")];
  const n = apply(s, "deal-action", {
    cardId: "a",
    targetId: "p1",
    propertyId: "take",
    ownPropertyId: "offer",
  });
  assert.deepEqual(
    n.data.properties.p0.map((c) => c.id),
    ["keep", "take"],
  );
  assert.deepEqual(
    n.data.properties.p1.map((c) => c.id),
    ["offer"],
  );
  assert.equal(n.data.event.transfers.length, 2);
  assert.deepEqual(ids(n), ids(s));
});
test("rent uses the largest owned group and transfer animation reports actual paid value", () => {
  const s = configured([action("double", "double_rent"), action("rent", "rent")]);
  s.data.properties.p0 = [land("h1", "hijaz"), land("h2", "hijaz"), land("h3", "hijaz")];
  s.data.banks.p1 = [money("paid", 10)];
  assert.equal(dealRent(s.data, "p0"), 3);
  const doubled = apply(s, "deal-action", { cardId: "double" });
  assert.equal(dealRent(doubled.data, "p0"), 6);
  const n = apply(doubled, "deal-action", { cardId: "rent", targetId: "p1" });
  assert.equal(n.data.event.transfers[0].amount, 10);
  assert.equal(n.data.rentMultiplier, 1);
  assert.equal(n.data.turnDeadline, s.data.turnDeadline);
  assert.deepEqual(ids(n), ids(s));
});
test("payment draws from public bank before land and never private hand", () => {
  const s = configured([action("debt", "debt")]);
  s.data.banks.p1 = [money("cash", 2)];
  s.data.properties.p1 = [land("land", "hijaz")];
  const hand = structuredClone(s.data.hands.p1);
  const n = apply(s, "deal-action", { cardId: "debt", targetId: "p1" });
  assert.equal(n.data.banks.p0[0].id, "cash");
  assert.equal(n.data.properties.p0[0].id, "land");
  assert.deepEqual(n.data.hands.p1, hand);
  assert.deepEqual(
    n.data.event.transfers.map((t) => t.kind),
    ["bank", "property"],
  );
  assert.deepEqual(ids(n), ids(s));
});
test("refusal consumes one shield, protects assets and still consumes the attacker action", () => {
  const s = configured([action("a", "steal")]);
  s.data.properties.p1 = [land("take", "hijaz")];
  s.data.hands.p1 = [action("shield", "just_say_no"), money("private")];
  const n = apply(s, "deal-action", { cardId: "a", targetId: "p1", propertyId: "take" });
  assert.equal(n.data.actionsLeft, 2);
  assert.deepEqual(n.data.properties, s.data.properties);
  assert.deepEqual(n.data.event.blockedIds, ["p1"]);
  assert.deepEqual(n.data.event.transfers, []);
  assert.equal(n.data.discard.at(-1).id, "shield");
  assert.deepEqual(ids(n), ids(s));
});
test("three different complete groups award one win and rematch retains roster, bots and wins", () => {
  const s = configured([action("a", "deal_breaker")]);
  s.bots = [{ ...players[3], isBot: true }];
  s.data.properties.p0 = [land("n1"), land("n2"), land("s1", "shamal"), land("s2", "shamal")];
  s.data.properties.p1 = [land("w1", "wadi"), land("w2", "wadi")];
  const n = apply(s, "deal-action", { cardId: "a", targetId: "p1", group: "wadi" });
  assert.equal(n.phase, "results");
  assert.equal(n.scores.p0, 1);
  assert.equal(completedDealSets(n.data.properties.p0), 3);
  assert.deepEqual(n.data.event.completedGroups, ["wadi"]);
  assert.equal(apply(n, "deal-action", { cardId: "a" }), n);
  const rematch = rematchDeal(n, players.slice().reverse(), 120000);
  assert.equal(rematch.round, 1);
  assert.equal(rematch.phase, "playing");
  assert.deepEqual(rematch.scores, n.scores);
  assert.deepEqual(rematch.bots, n.bots);
  assert.deepEqual(
    rematch.data.roster.map((p) => p.id),
    players.map((p) => p.id),
  );
  assert.equal(rematch.data.turnIndex, 1);
  assert.equal(rematch.data.turnDeadline, 210000);
  assert.ok(Object.values(rematch.data.hands).every((h) => h.length === 5));
  assert.ok(Object.values(rematch.data.properties).every((p) => !p.length));
  assert.equal(rematchDeal(s, players), s);
  assert.equal(
    reduceDeal(
      rematch,
      { type: "deal-draw", playerId: "p1", value: { round: 0, turnSequence: 1 } },
      players,
    ),
    rematch,
  );
});
test("disconnect and changed presence order preserve seat, private hand, clock and assets", () => {
  const s = start(),
    before = structuredClone(s);
  const order = getDealParticipants(s.data, [
    { ...players[3], joinedAt: 900 },
    players[0],
    { ...players[1], joinedAt: 950 },
  ]);
  assert.deepEqual(
    order.map((p) => p.id),
    players.map((p) => p.id),
  );
  assert.equal(order[2].connected, false);
  assert.equal(order[1].joinedAt, 101);
  const restored = getDealParticipants(
    s.data,
    players
      .slice()
      .reverse()
      .map((p) => ({ ...p, joinedAt: 999 })),
  );
  assert.ok(restored.every((p) => p.connected));
  assert.deepEqual(s, before);
});
test("legacy snapshots get a clock and roster without changing hands or public assets", () => {
  const s = configured([money("m")]);
  delete s.data.turnDeadline;
  delete s.data.turnStartedAt;
  delete s.data.turnSequence;
  delete s.data.roster;
  const n = apply(s, "deal-clock", {}, 5000);
  assert.equal(n.data.turnDeadline, 95000);
  assert.deepEqual(n.data.hands, s.data.hands);
  assert.deepEqual(n.data.properties, s.data.properties);
  assert.deepEqual(n.data.roster, players);
  assert.equal(apply(n, "deal-clock"), n);
});
test("deck recycling and many valid turns conserve every card across all zones", () => {
  for (let run = 0; run < 12; run++) {
    let s = start();
    const original = ids(s);
    for (let move = 0; move < 450 && s.phase === "playing"; move++) {
      const id = players[s.data.turnIndex].id,
        hand = s.data.hands[id];
      if (s.data.needsDraw) s = apply(s, "deal-draw");
      else if (s.data.endingTurn || hand.length > 7)
        s =
          hand.length > 7
            ? apply(s, "deal-discard", { cardId: hand.at(-1).id })
            : apply(s, "deal-end");
      else if (!hand.length) s = apply(s, "deal-end");
      else {
        const c = hand[0];
        s = apply(
          s,
          c.type === "property"
            ? "deal-property"
            : c.action === "draw2"
              ? "deal-action"
              : "deal-bank",
          { cardId: c.id },
        );
      }
      assert.deepEqual(ids(s), original);
      assert.ok(s.data.actionsLeft >= 0 && s.data.actionsLeft <= 3);
      if (s.data.needsDraw) assert.ok(Object.values(s.data.hands).every((h) => h.length <= 7));
    }
  }
});
