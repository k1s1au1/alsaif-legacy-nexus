import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(client) {
  const source = fs.readFileSync(new URL("../src/lib/daily-site-visits.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", compiled)(module, module.exports, () => ({ supabase: client }));
  return module.exports;
}

test("Saudi visit days roll at 21:00 UTC, including month/year/leap transitions, regardless of device zone", () => {
  const { saudiVisitDay, millisecondsUntilSaudiMidnight: remaining } = load({});
  const original = process.env.TZ;
  try {
    for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Asia/Riyadh"]) {
      process.env.TZ = zone;
      for (const [before, day, after] of [
        ["2026-10-16T20:59:59.999Z", "2026-10-16", "2026-10-17"],
        ["2026-12-31T20:59:59.999Z", "2026-12-31", "2027-01-01"],
        ["2028-02-28T20:59:59.999Z", "2028-02-28", "2028-02-29"],
        ["2028-02-29T20:59:59.999Z", "2028-02-29", "2028-03-01"],
      ]) {
        const at = new Date(before);
        assert.equal(saudiVisitDay(at), day, zone);
        assert.equal(remaining(at), 51);
        const midnight = new Date(at.getTime() + 1);
        assert.equal(saudiVisitDay(midnight), after, zone);
        assert.equal(remaining(midnight), 86_400_050);
      }
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("daily aggregate uses its server date and exact total, including a real zero", async () => {
  for (const visitor_count of [0, 1, 1248]) {
    const { fetchTodayVisitCount } = load({ rpc: async (...args) => {
      assert.deepEqual(args, ["get_today_site_visit_count"]);
      return { data: { visit_date: "2026-10-16", visitor_count }, error: null };
    } });
    assert.deepEqual(await fetchTodayVisitCount(), { visit_date: "2026-10-16", visitor_count });
  }
});

test("failed, offline and malformed responses never become an invented zero", async () => {
  const failure = { message: "denied", code: "42501" };
  await assert.rejects(load({ rpc: async () => ({ data: null, error: failure }) }).fetchTodayVisitCount(), e => e === failure);
  await assert.rejects(load({ rpc: async () => { throw new TypeError("offline"); } }).fetchTodayVisitCount(), /offline/);
  for (const data of [null, {}, { visit_date: "bad", visitor_count: 1 }, { visit_date: "2026-10-16", visitor_count: null }, { visit_date: "2026-10-16", visitor_count: -1 }, { visit_date: "2026-10-16", visitor_count: "3" }]) {
    await assert.rejects(load({ rpc: async () => ({ data, error: null }) }).fetchTodayVisitCount(), /تعذر قراءة/);
  }
});
