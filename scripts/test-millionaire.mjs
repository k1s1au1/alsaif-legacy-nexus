import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const directory = mkdtempSync(path.join(tmpdir(), "millionaire-rules-"));
writeFileSync(path.join(directory, "package.json"), '{"type":"module"}');
for (const file of ["millionaire-board", "millionaire-engine"]) {
  const source = readFileSync(new URL(`../src/components/entertainment/${file}.ts`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  writeFileSync(path.join(directory, `${file}.js`), output.replace('"./millionaire-board"', '"./millionaire-board.js"'));
}
const { initialMonopolyData, reduceMonopoly, chooseMillionaireBotAction } = await import(pathToFileURL(path.join(directory, "millionaire-engine.js")));
const { MILLIONAIRE_BOARD } = await import(pathToFileURL(path.join(directory, "millionaire-board.js")));
after(() => rmSync(directory, { recursive: true, force: true }));

const players = ["خالد", "سعود", "نورة", "فيصل"].map((name, index) => ({ id: `p${index}`, name, isBot: true, difficulty: "hard" }));
const fresh = () => ({ phase: "playing", scores: {}, data: initialMonopolyData(players) });
const apply = (state, type, value, playerId = players[state.data.turnIndex].id) => reduceMonopoly(state, { type, value, playerId }, players);
function withDice(dice, run) {
  const original = Math.random;
  let index = 0;
  Math.random = () => ((dice[index++] ?? 2) - 0.5) / 6;
  try { return run(); } finally { Math.random = original; }
}

test("each player starts with 5M and cannot play out of turn", () => {
  const state = fresh();
  assert.deepEqual(Object.values(state.data.cash), [5000, 5000, 5000, 5000]);
  assert.equal(apply(state, "monopoly-roll", undefined, "p1"), state);
  assert.equal(apply({ ...state, phase: "results" }, "monopoly-roll").phase, "results");
});

test("buying a hotel charges its full cost and a double grants another turn", () => {
  const initial = fresh();
  const rolled = withDice([1, 1], () => apply(initial, "monopoly-roll"));
  assert.equal(rolled.data.pending.type, "buy");
  const bought = apply(rolled, "monopoly-buy", { level: 3 });
  assert.equal(bought.data.properties[2].level, 3);
  assert.equal(bought.data.properties[2].invested, 610);
  assert.equal(bought.data.cash.p0, 4390);
  const next = apply(bought, "monopoly-end");
  assert.equal(next.data.turnIndex, 0);
  assert.equal(next.data.rolled, false);
  assert.equal(initial.data.positions.p0, 0, "reducers must not mutate received snapshots");
});

test("rent transfers to the owner and landmarks cannot be taken over", () => {
  const state = fresh();
  state.data.properties[2] = { ownerId: "p1", level: 4, invested: 1000 };
  const next = withDice([1, 1], () => apply(state, "monopoly-roll"));
  assert.equal(next.data.cash.p0, 5000 - 406);
  assert.equal(next.data.cash.p1, 5000 + 406);
  assert.equal(next.data.pending, null);
});

test("owned cities upgrade for the incremental cost", () => {
  const state = fresh();
  state.data.properties[2] = { ownerId: "p0", level: 1, invested: 300 };
  const landed = withDice([1, 1], () => apply(state, "monopoly-roll"));
  const upgraded = apply(landed, "monopoly-upgrade", { level: 4 });
  assert.equal(upgraded.data.properties[2].level, 4);
  assert.equal(upgraded.data.cash.p0, 5000 - 120 - 190 - 280);
  for (const level of [NaN, Infinity, "bad", 1.5, 8]) {
    assert.equal(apply(landed, "monopoly-upgrade", { level }), landed);
  }
});

test("takeover payments transfer cash without inflating the property's building value", () => {
  const state = fresh();
  state.data.properties[2] = { ownerId: "p1", level: 1, invested: 300 };
  const landed = withDice([1, 1], () => apply(state, "monopoly-roll"));
  const taken = apply(landed, "monopoly-takeover");
  assert.equal(taken.data.properties[2].ownerId, "p0");
  assert.equal(taken.data.properties[2].invested, 300);
  assert.equal(taken.data.cash.p0, 4374);
  assert.equal(taken.data.cash.p1, 5626);
  assert.equal(Object.values(taken.data.cash).reduce((sum, cash) => sum + cash, 0), 20000);
});

test("invalid purchases and ending an unresolved purchase cannot corrupt money", () => {
  const landed = withDice([1, 1], () => apply(fresh(), "monopoly-roll"));
  for (const level of [NaN, Infinity, "bad", 0, 1.5, 4]) {
    assert.equal(apply(landed, "monopoly-buy", { level }), landed);
  }
  assert.equal(apply(landed, "monopoly-end"), landed);
});

test("passing start awards the bonus and three doubles send the player to the island", () => {
  const state = fresh();
  state.data.positions.p0 = 23;
  const passed = withDice([1, 1], () => apply(state, "monopoly-roll"));
  assert.equal(passed.data.cash.p0, 5300);
  const streak = fresh();
  streak.data.doublesStreak = 2;
  const island = withDice([2, 2], () => apply(streak, "monopoly-roll"));
  assert.equal(island.data.positions.p0, 6);
  assert.equal(island.data.jailTurns.p0, 3);
  assert.equal(island.data.extraTurn, false);
});

test("selling an asset raises cash for debt repayment", () => {
  const state = fresh();
  state.data.rolled = true;
  state.data.cash.p0 = 10;
  state.data.properties[1] = { ownerId: "p0", level: 1, invested: 220 };
  state.data.pending = { type: "debt", playerId: "p0", creditorId: "p1", amount: 100, reason: "رسوم" };
  const sold = apply(state, "monopoly-sell", { spaceIndex: 1 });
  const paid = apply(sold, "monopoly-pay-debt");
  assert.equal(paid.data.cash.p0, 64);
  assert.equal(paid.data.cash.p1, 5100);
  assert.equal(paid.data.pending, null);
});

test("human bankruptcy transfers assets and immediately advances the turn", () => {
  const state = fresh();
  state.data.rolled = true;
  state.data.cash.p0 = 50;
  state.data.properties[1] = { ownerId: "p0", level: 1, invested: 220 };
  state.data.pending = { type: "debt", playerId: "p0", creditorId: "p1", amount: 800 };
  const next = apply(state, "monopoly-bankrupt");
  assert.equal(next.data.bankrupt.p0, true);
  assert.equal(next.data.properties[1].ownerId, "p1");
  assert.equal(next.data.cash.p1, 5050);
  assert.equal(next.data.turnIndex, 1);
  assert.equal(next.data.rolled, false);
  assert.ok(chooseMillionaireBotAction(next, players));
});

test("the final solvent player wins and cannot be awarded twice", () => {
  const state = fresh();
  state.data.bankrupt = { p2: true, p3: true };
  state.data.pending = { type: "debt", playerId: "p0", creditorId: "p1", amount: 8000 };
  const result = apply(state, "monopoly-bankrupt");
  assert.equal(result.phase, "results");
  assert.equal(result.data.winnerId, "p1");
  assert.equal(result.scores.p1, 1);
  assert.equal(apply(result, "monopoly-bankrupt", undefined, "p0"), result);
});

test("100 seeded bot matches finish without stuck turns or invalid balances", () => {
  const original = Math.random;
  try {
    for (let seed = 1; seed <= 100; seed += 1) {
      let random = seed;
      Math.random = () => ((random = (Math.imul(random, 1664525) + 1013904223) >>> 0) / 4294967296);
      let state = fresh();
      for (let step = 0; step < 5000 && state.phase === "playing"; step += 1) {
        const action = chooseMillionaireBotAction(state, players);
        assert.ok(action, `seed ${seed}: active turn has no legal action`);
        const next = reduceMonopoly(state, action, players);
        assert.notEqual(next, state, `seed ${seed}: ${action.type} stalls the match`);
        state = next;
        for (const cash of Object.values(state.data.cash)) assert.ok(Number.isFinite(cash) && cash >= 0);
        for (const [index, property] of Object.entries(state.data.properties)) {
          assert.ok(MILLIONAIRE_BOARD[index]);
          assert.ok(players.some((player) => player.id === property.ownerId));
          assert.ok(Number.isInteger(property.level) && property.level >= 1 && property.level <= 4);
          assert.ok(Number.isFinite(property.invested) && property.invested > 0);
        }
      }
      assert.equal(state.phase, "results", `seed ${seed}: match never finishes`);
    }
  } finally { Math.random = original; }
});
