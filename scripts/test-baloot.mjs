import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const temp = mkdtempSync(path.join(tmpdir(), "baloot-rules-"));
writeFileSync(path.join(temp, "package.json"), '{"type":"module"}');
writeFileSync(
  path.join(temp, "engine.js"),
  ts.transpileModule(
    readFileSync(
      new URL("../src/components/entertainment/baloot-engine.ts", import.meta.url),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
  ).outputText,
);
const {
  BALOOT_BID_MS,
  BALOOT_PLAY_MS,
  BALOOT_COLLECT_MS,
  BALOOT_SUITS,
  initialBalootData,
  reduceBaloot,
  rematchBaloot,
  getBalootParticipants,
  legalBalootCards,
  sortBalootHand,
  balootCardPoints,
  balootCardStrength,
} = await import(pathToFileURL(path.join(temp, "engine.js")));
after(() => rmSync(temp, { recursive: true, force: true }));
const players = ["خالد", "نواف", "عمر", "عبدالله"].map((name, i) => ({
  id: `p${i}`,
  name,
  avatarUrl: null,
  joinedAt: 100 + i,
  ready: true,
}));
const start = (dealer = 3) => ({
  phase: "playing",
  round: 0,
  scores: {},
  bots: [],
  data: initialBalootData(players, [0, 0], dealer, 1000),
});
const activeId = (s) =>
  players[s.data.stage === "bidding" ? s.data.bidTurnIndex : s.data.turnIndex].id;
const stamp = (s, value = {}) => ({ ...value, turnSequence: s.data.turnSequence, round: s.round });
const apply = (s, type, value = {}, now = s.data.turnStartedAt + 100) =>
  reduceBaloot(s, { type, playerId: activeId(s), value: stamp(s, value) }, players, now);
const expire = (s, now = s.data.turnDeadline) =>
  apply(s, "baloot-timeout", { deadline: s.data.turnDeadline }, now);
const buy = (mode = "sun", dealer = 3) => apply(start(dealer), "baloot-bid", { mode });
const card = (id, suit = "hearts", rank = "7") => ({ id, suit, rank });
function collect(s, now = s.data.pendingTrick.resolveAt) {
  return reduceBaloot(
    s,
    {
      type: "baloot-collect",
      playerId: "p0",
      value: stamp(s, {
        resolveAt: s.data.pendingTrick.resolveAt,
        trickSequence: s.data.lastTrick.sequence,
      }),
    },
    players,
    now,
  );
}
const initialIds = (s) =>
  [...Object.values(s.data.hands).flat(), ...s.data.drawPile, s.data.buyCard]
    .map((c) => c.id)
    .sort();
function finalTrick(mode = "sun", buyer = 0) {
  const s = buy(mode);
  s.data.contract = {
    mode,
    trump: mode === "hokm" ? "spades" : null,
    buyerIndex: buyer,
    buyerId: players[buyer].id,
  };
  s.data.hands = Object.fromEntries(
    players.map((p, i) => [p.id, [card(`last-${i}`, "hearts", ["7", "8", "9", "J"][i])]]),
  );
  s.data.rawPoints = mode === "sun" ? [65, 53] : [80, 70];
  s.data.teamTricks = [3, 4];
  return s;
}
function playTrick(s) {
  for (let i = 0; i < 4; i++)
    s = apply(s, "baloot-play", { cardId: legalBalootCards(s.data, activeId(s))[0].id });
  return s;
}

test("32 unique cards: five private cards per seat, one buy card and eleven remaining", () => {
  const s = start();
  assert.equal(new Set(initialIds(s)).size, 32);
  assert.equal(s.data.drawPile.length, 11);
  assert.ok(Object.values(s.data.hands).every((h) => h.length === 5));
  assert.deepEqual(s.data.roster, players);
  assert.equal(s.data.bidTurnIndex, 0);
  assert.equal(s.data.turnDeadline, 46000);
});
for (const mode of ["sun", "hokm"])
  for (let dealer = 0; dealer < 4; dealer++) {
    test(`${mode}: buyer after dealer ${dealer} receives the buy card and all four seats have eight`, () => {
      const before = start(dealer),
        all = initialIds(before),
        s = apply(before, "baloot-bid", { mode }, 1500);
      assert.ok(Object.values(s.data.hands).every((h) => h.length === 8));
      assert.deepEqual(
        Object.values(s.data.hands)
          .flat()
          .map((c) => c.id)
          .sort(),
        all,
      );
      assert.equal(s.data.drawPile.length, 0);
      assert.equal(s.data.contract.buyerIndex, (dealer + 1) % 4);
      assert.ok(s.data.hands[s.data.contract.buyerId].some((c) => c.id === before.data.buyCard.id));
      assert.equal(s.data.turnDeadline, 1500 + BALOOT_PLAY_MS);
      assert.equal(s.data.turnIndex, s.data.contract.buyerIndex);
      assert.equal(s.data.contract.trump, mode === "sun" ? null : before.data.buyCard.suit);
      assert.equal(before.data.stage, "bidding");
    });
  }
test("four passes reach the second buying round without changing anyone's hand", () => {
  let s = start();
  const hands = structuredClone(s.data.hands);
  for (let i = 0; i < 4; i++) s = apply(s, "baloot-pass");
  assert.equal(s.data.biddingRound, 2);
  assert.equal(s.data.bidTurnIndex, 0);
  assert.equal(s.data.passes, 0);
  assert.deepEqual(s.data.hands, hands);
  assert.equal(s.data.turnSequence, 5);
});
for (const suit of BALOOT_SUITS)
  test(`second buying round allows alternate trump ${suit}, rejects the buy-card suit`, () => {
    let s = start();
    for (let i = 0; i < 4; i++) s = apply(s, "baloot-pass");
    const n = apply(s, "baloot-bid", { mode: "hokm", trump: suit });
    assert.equal(n === s, suit === s.data.buyCard.suit);
    if (n !== s) assert.equal(n.data.contract.trump, suit);
  });
test("eight timed-out bids redeal once, retaining team identity, score and session wins", () => {
  let s = start();
  s.data.matchScore = [44, 52];
  s.data.sessionWins = [2, 1];
  for (let i = 0; i < 8; i++) s = expire(s);
  assert.equal(s.data.biddingRound, 1);
  assert.equal(s.data.dealerIndex, 0);
  assert.deepEqual(s.data.matchScore, [44, 52]);
  assert.deepEqual(s.data.sessionWins, [2, 1]);
  assert.equal(s.data.turnSequence, 9);
  assert.equal(s.data.turnDeadline - s.data.turnStartedAt, BALOOT_BID_MS);
});
test("off-turn purchase, invalid purchase and early/forged/stale expiry leave the state unchanged", () => {
  const s = start();
  const actions = [
    { type: "baloot-bid", playerId: "p1", value: stamp(s, { mode: "sun" }) },
    { type: "baloot-bid", playerId: "p0", value: stamp(s, { mode: "wrong" }) },
    { type: "baloot-timeout", playerId: "p0", value: stamp(s, { deadline: s.data.turnDeadline }) },
    { type: "baloot-pass", playerId: "p0", value: { ...stamp(s), turnSequence: 99 } },
    { type: "baloot-pass", playerId: "p0", value: { ...stamp(s), round: 99 } },
  ];
  for (const action of actions) assert.equal(reduceBaloot(s, action, players, 2000), s);
  assert.equal(
    apply(s, "baloot-timeout", { deadline: s.data.turnDeadline - 1 }, s.data.turnDeadline),
    s,
  );
  assert.equal(apply({ ...s, phase: "lobby" }, "baloot-pass").phase, "lobby");
});
test("a purchase arriving at the deadline becomes an automatic pass", () => {
  const s = start(),
    n = apply(s, "baloot-bid", { mode: "sun" }, s.data.turnDeadline);
  assert.equal(n.data.stage, "bidding");
  assert.equal(n.data.bidTurnIndex, 1);
  assert.match(n.data.lastAction, /بس تلقائيًا/);
  assert.equal(n.data.turnDeadline, s.data.turnDeadline + BALOOT_BID_MS);
});
test("the same timed-out bid packet cannot pass twice", () => {
  const s = start(),
    n = expire(s);
  assert.equal(
    reduceBaloot(
      n,
      {
        type: "baloot-timeout",
        playerId: "p0",
        value: stamp(s, { deadline: s.data.turnDeadline }),
      },
      players,
      n.data.turnDeadline,
    ),
    n,
  );
});
test("following suit is enforced by both the legal-card list and reducer", () => {
  const s = buy();
  s.data.trick = [{ playerId: "p3", card: card("lead", "hearts", "A") }];
  s.data.hands.p0 = [card("legal", "hearts", "10"), card("wrong", "spades", "J")];
  assert.deepEqual(
    legalBalootCards(s.data, "p0").map((c) => c.id),
    ["legal"],
  );
  assert.equal(apply(s, "baloot-play", { cardId: "wrong" }), s);
  assert.equal(apply(s, "baloot-play", { cardId: "unknown" }), s);
  const n = apply(s, "baloot-play", { cardId: "legal" });
  assert.equal(n.data.hands.p0.length, 1);
  assert.equal(n.data.trick[1].card.id, "legal");
});
test("without the lead suit all held cards are legal and private sorting is pure", () => {
  const s = buy("hokm");
  s.data.trick = [{ playerId: "p3", card: card("lead", "hearts", "A") }];
  const hand = [card("a", "clubs", "7"), card("b", "spades", "J"), card("c", "spades", "9")];
  s.data.hands.p0 = hand;
  const before = structuredClone(s);
  assert.equal(legalBalootCards(s.data, "p0").length, 3);
  s.data.contract.trump = "spades";
  before.data.contract.trump = "spades";
  assert.deepEqual(
    sortBalootHand(hand, s.data.contract).map((c) => c.id),
    ["b", "c", "a"],
  );
  assert.deepEqual(sortBalootHand(hand, s.data.contract, false), hand);
  assert.deepEqual(s, before);
});
test("play expiry chooses a cheap legal card and never skips a seat in the trick", () => {
  const s = buy();
  s.data.trick = [{ playerId: "p3", card: card("lead", "hearts", "Q") }];
  s.data.hands.p0 = [
    card("ace", "hearts", "A"),
    card("seven", "hearts", "7"),
    card("other", "clubs", "7"),
  ];
  const n = expire(s);
  assert.equal(n.data.trick[1].playerId, "p0");
  assert.equal(n.data.trick[1].card.id, "seven");
  assert.equal(n.data.turnIndex, 1);
  assert.equal(n.data.turnDeadline, s.data.turnDeadline + BALOOT_PLAY_MS);
  assert.match(n.data.event.type, /timeout/);
});
test("a late manual play also uses the expiry rule, ignoring the late choice", () => {
  const s = buy();
  s.data.hands.p0 = [card("valuable", "hearts", "A"), card("cheap", "hearts", "7")];
  const n = apply(s, "baloot-play", { cardId: "valuable" }, s.data.turnDeadline);
  assert.equal(n.data.trick[0].card.id, "cheap");
});
test("each accepted card gives the next player a fresh 30 seconds", () => {
  let s = buy();
  for (let i = 0; i < 3; i++) {
    const now = 5000 + i * 1000,
      seq = s.data.turnSequence;
    s = apply(s, "baloot-play", { cardId: legalBalootCards(s.data, activeId(s))[0].id }, now);
    assert.equal(s.data.turnDeadline, now + BALOOT_PLAY_MS);
    assert.equal(s.data.turnSequence, seq + 1);
  }
});
test("trick winner retains four visible cards during collection, with no clock or allowed move", () => {
  const s = playTrick(buy());
  assert.equal(s.data.trick.length, 4);
  assert.equal(s.data.lastTrick.plays.length, 4);
  assert.equal(s.data.turnDeadline, null);
  assert.equal(s.data.pendingTrick.resolveAt - s.data.lastTrick.at, BALOOT_COLLECT_MS);
  assert.equal(legalBalootCards(s.data, "p0").length, 0);
  assert.equal(apply(s, "baloot-play", { cardId: s.data.hands[activeId(s)][0].id }), s);
  assert.equal(collect(s, s.data.pendingTrick.resolveAt - 1), s);
  const n = collect(s);
  assert.equal(n.data.trick.length, 0);
  assert.equal(n.data.turnIndex, s.data.pendingTrick.winnerIndex);
  assert.equal(n.data.turnDeadline, s.data.pendingTrick.resolveAt + BALOOT_PLAY_MS);
  assert.deepEqual(n.data.lastTrick, s.data.lastTrick);
});
test("stale collection and stale play cannot erase a newer trick or charge points twice", () => {
  const s = playTrick(buy()),
    n = collect(s);
  const stale = {
    type: "baloot-collect",
    playerId: "p0",
    value: stamp(s, {
      resolveAt: s.data.pendingTrick.resolveAt,
      trickSequence: s.data.lastTrick.sequence,
    }),
  };
  assert.equal(reduceBaloot(n, stale, players, n.data.turnStartedAt + 10), n);
  assert.equal(
    reduceBaloot(
      n,
      {
        type: "baloot-play",
        playerId: activeId(n),
        value: stamp(s, { cardId: n.data.hands[activeId(n)][0].id }),
      },
      players,
      n.data.turnStartedAt + 10,
    ),
    n,
  );
});
test("a resumed collecting snapshot resolves once and retains the last-trick record", () => {
  const s = playTrick(buy()),
    resumed = JSON.parse(JSON.stringify(s));
  const n = collect(resumed, resumed.data.pendingTrick.resolveAt + 5000);
  assert.equal(
    n.data.teamTricks.reduce((a, b) => a + b),
    1,
  );
  assert.deepEqual(n.data.rawPoints, s.data.rawPoints);
  assert.deepEqual(n.data.lastTrick, s.data.lastTrick);
});
test("sun rank order and trump J/9 strength and points retain existing rules", () => {
  assert.ok(
    balootCardStrength(card("a", "hearts", "A"), "hearts", "sun", null) >
      balootCardStrength(card("j", "hearts", "J"), "hearts", "sun", null),
  );
  assert.ok(
    balootCardStrength(card("j", "spades", "J"), "hearts", "hokm", "spades") >
      balootCardStrength(card("nine", "spades", "9"), "hearts", "hokm", "spades"),
  );
  assert.equal(balootCardPoints(card("j", "spades", "J"), "hokm", "spades"), 20);
  assert.equal(balootCardPoints(card("nine", "spades", "9"), "hokm", "spades"), 14);
  assert.equal(balootCardPoints(card("j", "hearts", "J"), "hokm", "spades"), 2);
});
for (const mode of ["sun", "hokm"])
  test(`${mode}: tied buyer loses, summary separates raw, converted and awarded points`, () => {
    const n = collect(playTrick(finalTrick(mode))),
      total = mode === "sun" ? 26 : 16;
    assert.equal(n.data.stage, "round-end");
    assert.deepEqual(n.data.roundSummary.beforePenalty, [total / 2, total / 2]);
    assert.equal(n.data.roundSummary.buyerSucceeded, false);
    assert.deepEqual(n.data.roundPoints, [0, total]);
    assert.deepEqual(n.data.matchScore, [0, total]);
    assert.equal(n.data.roundSummary.lastTrickTeam, 1);
    assert.equal(n.scores.p0, n.scores.p2);
    assert.equal(n.scores.p1, n.scores.p3);
  });
test("a successful buyer retains both teams' earned points", () => {
  const s = finalTrick();
  s.data.rawPoints = [70, 48];
  const n = collect(playTrick(s));
  assert.equal(n.data.roundSummary.buyerSucceeded, true);
  assert.deepEqual(n.data.roundPoints, [14, 12]);
});
test("winning the match increments only that team's session wins once", () => {
  const s = finalTrick();
  s.data.matchScore = [144, 145];
  s.data.sessionWins = [2, 3];
  const pending = playTrick(s),
    n = collect(pending);
  assert.equal(n.phase, "results");
  assert.equal(n.data.matchWinnerTeam, 1);
  assert.deepEqual(n.data.sessionWins, [2, 4]);
  assert.equal(
    reduceBaloot(
      n,
      {
        type: "baloot-collect",
        playerId: "p0",
        value: stamp(pending, {
          resolveAt: pending.data.pendingTrick.resolveAt,
          trickSequence: pending.data.lastTrick.sequence,
        }),
      },
      players,
      999999,
    ),
    n,
  );
});
test("next round retains match totals and session wins, starts 45 seconds and rotates dealer", () => {
  const s = collect(playTrick(finalTrick()));
  s.data.sessionWins = [2, 1];
  const n = apply(s, "baloot-next-round", {}, 50000);
  assert.deepEqual(n.data.matchScore, s.data.matchScore);
  assert.deepEqual(n.data.sessionWins, [2, 1]);
  assert.equal(n.round, s.round + 1);
  assert.equal(n.data.matchRound, 2);
  assert.equal(n.data.turnDeadline, 50000 + BALOOT_BID_MS);
  assert.equal(n.data.dealerIndex, 0);
  assert.equal(n.data.lastTrick, null);
});
test("reconnect cannot change the canonical seats, partnership, held cards or deadline", () => {
  const s = buy(),
    before = structuredClone(s),
    live = [
      players[3],
      { ...players[0], joinedAt: 999, name: "خالد السيف" },
      { id: "intruder", name: "ضيف", joinedAt: 1 },
    ];
  const roster = getBalootParticipants(s.data, live);
  assert.deepEqual(
    roster.map((p) => p.id),
    players.map((p) => p.id),
  );
  assert.equal(roster[0].joinedAt, 100);
  assert.equal(roster[0].name, "خالد السيف");
  assert.equal(roster[2].connected, false);
  assert.deepEqual(s, before);
  const n = reduceBaloot(
    s,
    { type: "baloot-play", playerId: "p0", value: stamp(s, { cardId: s.data.hands.p0[0].id }) },
    live,
    2000,
  );
  assert.equal(n.data.turnIndex, 1);
  assert.deepEqual(n.data.hands.p2, s.data.hands.p2);
});
test("disconnected players and bots retain their seats and timeout can still play their legal card", () => {
  const s = buy();
  s.data.roster[1].isBot = true;
  const disconnected = getBalootParticipants(s.data, [players[2]]);
  assert.equal(disconnected[0].connected, false);
  assert.equal(disconnected[1].connected, true);
  const n = reduceBaloot(
    s,
    { type: "baloot-timeout", playerId: "p0", value: stamp(s, { deadline: s.data.turnDeadline }) },
    [players[2]],
    s.data.turnDeadline,
  );
  assert.equal(n.data.trick.length, 1);
  assert.equal(n.data.turnIndex, 1);
});
test("rematch retains teams, bots and win tally, resets match points and rotates dealer", () => {
  const s = collect(playTrick(finalTrick()));
  s.phase = "results";
  s.data.sessionWins = [2, 4];
  s.bots = [{ ...players[3], isBot: true }];
  s.data.roster[3].isBot = true;
  const n = rematchBaloot(s, players.slice().reverse(), 90000);
  assert.equal(n.phase, "playing");
  assert.deepEqual(
    n.data.roster.map((p) => p.id),
    players.map((p) => p.id),
  );
  assert.deepEqual(n.data.sessionWins, [2, 4]);
  assert.deepEqual(n.data.matchScore, [0, 0]);
  assert.deepEqual(n.bots, s.bots);
  assert.equal(n.data.matchNumber, 2);
  assert.equal(n.data.matchRound, 1);
  assert.equal(n.data.turnDeadline, 90000 + BALOOT_BID_MS);
  assert.equal(n.data.dealerIndex, 0);
  assert.equal(rematchBaloot(n, players), n);
});
test("legacy saved data receives a clock and roster once, without redealing", () => {
  const s = buy();
  delete s.data.turnDeadline;
  delete s.data.turnSequence;
  delete s.data.roster;
  const n = reduceBaloot(s, { type: "baloot-clock", playerId: "p0" }, players, 8000);
  assert.deepEqual(n.data.hands, s.data.hands);
  assert.equal(n.data.turnDeadline, 8000 + BALOOT_PLAY_MS);
  assert.deepEqual(n.data.roster, players);
  assert.equal(apply(n, "baloot-clock"), n);
});
test("serialization and a different host clock preserve the original deadline", () => {
  const s = buy(),
    wire = JSON.parse(JSON.stringify(s));
  const localNow = 900000,
    offset = s.data.turnStartedAt - localNow;
  assert.equal(localNow + offset + 29999, s.data.turnDeadline - 1);
  assert.equal(expire(wire, localNow + offset + 29999), wire);
  const n = expire(wire, localNow + offset + 30000);
  assert.equal(n.data.trick.length, 1);
});
for (const mode of ["sun", "hokm"])
  test(`${mode}: full rounds with legal and automatic moves conserve all 32 played cards and points`, () => {
    for (let run = 0; run < 20; run++) {
      let s = buy(mode, run % 4),
        original = Object.values(s.data.hands)
          .flat()
          .map((c) => c.id)
          .sort(),
        played = [];
      for (let move = 0; move < 40 && s.data.stage !== "round-end"; move++) {
        if (s.data.pendingTrick) {
          played.push(...s.data.trick.map((p) => p.card.id));
          s = collect(s);
        } else {
          const legal = legalBalootCards(s.data, activeId(s));
          s =
            move % 3 === 0
              ? expire(s)
              : apply(s, "baloot-play", { cardId: legal[run % legal.length].id });
        }
      }
      assert.equal(s.data.stage, "round-end");
      assert.deepEqual(played.sort(), original);
      assert.equal(s.data.teamTricks[0] + s.data.teamTricks[1], 8);
      assert.equal(s.data.rawPoints[0] + s.data.rawPoints[1], mode === "sun" ? 130 : 162);
      assert.equal(s.data.roundPoints[0] + s.data.roundPoints[1], mode === "sun" ? 26 : 16);
      assert.ok(Object.values(s.data.hands).every((h) => h.length === 0));
    }
  });
