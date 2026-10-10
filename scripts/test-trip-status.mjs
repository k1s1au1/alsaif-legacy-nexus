import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

function loadModule(path, client, cache = new Map()) {
  if (cache.has(path)) return cache.get(path);
  const source = fs.readFileSync(new URL(`../src/${path}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", compiled)(module, module.exports, (id) =>
    id === "@/integrations/supabase/client"
      ? { supabase: client }
      : loadModule(id.replace(/^@\//, ""), client, cache),
  );
  cache.set(path, module.exports);
  return module.exports;
}

function fixture({ error = null, readback } = {}) {
  const writes = [];
  const trip = {
    id: "trip-1",
    title: "العلا",
    status: "upcoming",
    end_date: "2099-01-02",
    image_url: "private/image.jpg",
  };
  const client = {
    from(table) {
      assert.equal(table, "trips");
      return {
        update(payload) {
          writes.push(payload);
          return {
            eq(key, value) {
              assert.equal(key, "id");
              assert.equal(value, trip.id);
              return {
                select(columns) {
                  assert.equal(columns, "id,status");
                  return {
                    async single() {
                      if (error) return { data: null, error };
                      Object.assign(trip, payload);
                      return {
                        data:
                          readback === undefined ? { id: trip.id, status: trip.status } : readback,
                        error: null,
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return { ...loadModule("lib/api/trip-status", client), writes, trip };
}

test("each selected status persists alone without rewriting trip content or dates", async () => {
  const f = fixture();
  for (const status of ["planning", "past", "upcoming"]) {
    assert.deepEqual(await f.updateTripStatus("trip-1", status), { id: "trip-1", status });
    assert.equal(f.trip.status, status);
    assert.deepEqual(f.writes.at(-1), { status });
  }
  assert.equal(f.trip.title, "العلا");
  assert.equal(f.trip.end_date, "2099-01-02");
  assert.equal(f.trip.image_url, "private/image.jpg");
});

test("a database permission denial does not change the trip or retry through a privileged client", async () => {
  const error = { message: "row-level security", code: "42501" };
  const f = fixture({ error });
  await assert.rejects(f.updateTripStatus("trip-1", "past"), (failure) => failure === error);
  assert.equal(f.trip.status, "upcoming");
  assert.equal(f.writes.length, 1);
});

test("missing or mismatched server readback cannot report a successful status update", async () => {
  for (const readback of [
    null,
    { id: "another-trip", status: "past" },
    { id: "trip-1", status: "upcoming" },
  ]) {
    const f = fixture({ readback });
    await assert.rejects(f.updateTripStatus("trip-1", "past"), /تعذر التحقق/);
    assert.equal(f.writes.length, 1);
  }
});

test("invalid status values and missing IDs never reach the database", async () => {
  const f = fixture();
  await assert.rejects(f.updateTripStatus("", "past"));
  await assert.rejects(f.updateTripStatus("trip-1", "not-a-status"));
  await assert.rejects(f.updateTripStatus("trip-1", "cancelled"));
  assert.equal(f.writes.length, 0);
});

test("list and details share Arabic labels, including pre-existing legacy statuses", () => {
  const { TRIP_STATUS_OPTIONS, tripStatusLabel } = loadModule("lib/trip-status");
  assert.deepEqual(
    TRIP_STATUS_OPTIONS.map(({ value }) => tripStatusLabel(value)),
    ["قادمة", "قيد التخطيط", "سابقة"],
  );
  assert.equal(tripStatusLabel("ongoing"), "جارية");
  assert.equal(tripStatusLabel("completed"), "منتهية");
  assert.equal(tripStatusLabel("cancelled"), "ملغاة");
});
