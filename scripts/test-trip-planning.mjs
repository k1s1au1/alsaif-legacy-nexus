import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

process.env.TZ = "Asia/Riyadh";
function load(path, client, cache = new Map()) {
  if (cache.has(path)) return cache.get(path);
  const source = fs.readFileSync(new URL(`../src/${path}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", compiled)(module, module.exports, (id) =>
    id === "@/integrations/supabase/client"
      ? { supabase: client }
      : load(id.replace(/^@\//, ""), client, cache),
  );
  cache.set(path, module.exports);
  return module.exports;
}
const domain = load("lib/trip-planning");
const trip = {
  id: "trip",
  title: "العلا",
  status: "planning",
  location: null,
  start_date: null,
  end_date: null,
  planning_revision: 3,
  approval_version: 2,
};
function api(result, error = null) {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: result, error };
    },
  };
  return { ...load("lib/api/trip-planning", client), calls };
}

test("planning remains open when draft dates have passed; approved trips stay through their final Saudi day", () => {
  assert.equal(
    domain.tripPhase({ ...trip, start_date: "2000-01-01", end_date: "2000-01-02" }),
    "planning",
  );
  const approved = {
    ...trip,
    status: "upcoming",
    start_date: "2026-10-10",
    end_date: "2026-10-12",
  };
  assert.equal(domain.tripPhase(approved, new Date("2026-10-09T12:00:00+03:00")), "upcoming");
  assert.equal(domain.tripPhase(approved, new Date("2026-10-12T23:59:59+03:00")), "current");
  assert.equal(domain.tripPhase(approved, new Date("2026-10-13T00:00:00+03:00")), "past");
  assert.equal(domain.tripPhase({ ...approved, status: "past" }), "past");
});
test("approval requires a location and real dates in the correct order", () => {
  for (const args of [
    ["", "2099-01-01", "2099-01-02"],
    ["العلا", "2099-02-30", "2099-03-01"],
    ["العلا", "2099-01-02", "2099-01-01"],
    ["العلا", "2000-01-01", "2000-01-02"],
  ])
    assert.throws(() => domain.validateApproval(...args));
  assert.doesNotThrow(() => domain.validateApproval("العلا", "2099-01-01", "2099-01-01"));
});
test("old votes and attendance are excluded after the plan or approval changes", () => {
  const votes = [
    { revision: 2, interested: true },
    { revision: 3, interested: true },
  ];
  assert.equal(domain.currentPreferences(trip, votes).length, 1);
  assert.deepEqual(
    domain.confirmedAttendees(trip, [
      { status: "going", approval_version: 1 },
      { status: "going", approval_version: 2 },
      { status: "not_going", approval_version: 2 },
    ]),
    [{ status: "going", approval_version: 2 }],
  );
});
test("members edit their creations, volunteer to open preparations and complete their own assignments", () => {
  const item = { id: "item", created_by: "creator", assigned_to: null, completed_at: null };
  assert.deepEqual(domain.preparationPermissions(item, "other", false), {
    edit: false,
    remove: false,
    claim: true,
    complete: false,
    release: false,
  });
  assert.equal(domain.preparationPermissions(item, "creator", false).edit, true);
  assert.equal(
    domain.preparationPermissions({ ...item, assigned_to: "other" }, "creator", false).complete,
    false,
  );
  assert.equal(
    domain.preparationPermissions({ ...item, assigned_to: "other" }, "other", false).complete,
    true,
  );
  assert.equal(
    domain.preparationPermissions(
      { ...item, assigned_to: "other", completed_at: "now" },
      "other",
      false,
    ).release,
    false,
  );
  assert.equal(
    domain.preparationPermissions({ ...item, assigned_to: "other" }, "manager", true).release,
    true,
  );
  assert.equal(domain.preparationPermissions(item, null, false).claim, false);
});
test("interest saves only to preferences, with the reviewed plan revision", async () => {
  const choice = { interested: true, destination_id: "a", date_id: "b" };
  const f = api({ trip_id: "trip", user_id: "me", revision: 3, ...choice });
  await f.saveTripPreference(trip, choice);
  assert.deepEqual(f.calls, [
    {
      name: "save_trip_preference",
      args: {
        _trip_id: "trip",
        _interested: true,
        _destination_id: "a",
        _date_id: "b",
        _revision: 3,
      },
    },
  ]);
  const mismatched = api({ trip_id: "trip", revision: 3, ...choice, interested: false });
  await assert.rejects(mismatched.saveTripPreference(trip, choice), /تعذر التحقق/);
});
test("approval verifies final server values and never retries a permission error", async () => {
  const f = api({
    ...trip,
    status: "upcoming",
    location: "العلا",
    start_date: "2099-01-01",
    end_date: "2099-01-03",
  });
  await f.approveTrip(trip, " العلا ", "2099-01-01", "2099-01-03");
  assert.equal(f.calls[0].args._revision, 3);
  const permission = { code: "42501", message: "denied" };
  const denied = api(null, permission);
  await assert.rejects(
    denied.approveTrip(trip, "العلا", "2099-01-01", "2099-01-03"),
    (e) => e === permission,
  );
  assert.equal(denied.calls.length, 1);
  await assert.rejects(
    api({ ...trip, status: "upcoming" }).approveTrip(trip, "العلا", "2099-01-01", "2099-01-03"),
    /تعذر التحقق/,
  );
});
test("attendance persists companions and never silently retries without them", async () => {
  const f = api({ status: "going", companions_count: 5, approval_version: 2 });
  await f.saveTripAttendance(trip, "going", 5);
  assert.equal(f.calls[0].args._companions, 5);
  assert.equal(f.calls[0].args._version, 2);
  const mismatch = api({ status: "going", companions_count: 0, approval_version: 2 });
  await assert.rejects(mismatch.saveTripAttendance(trip, "going", 5), /تعذر التحقق/);
  assert.equal(mismatch.calls.length, 1);
  const invalid = api(null);
  await assert.rejects(invalid.saveTripAttendance(trip, "going", 51));
  assert.equal(invalid.calls.length, 0);
});
test("a preparation action must return the requested state, including race and denied failures", async () => {
  await assert.rejects(
    api({ id: "item", assigned_to: null }).setPreparationState("item", "claim"),
    /تعذر التحقق/,
  );
  await assert.rejects(
    api({ id: "item", completed_at: null }).setPreparationState("item", "complete"),
    /تعذر التحقق/,
  );
  const race = { message: "تولى عضو آخر هذا التجهيز" };
  const f = api(null, race);
  await assert.rejects(f.setPreparationState("item", "claim"), (e) => e === race);
  assert.equal(f.calls.length, 1);
});
