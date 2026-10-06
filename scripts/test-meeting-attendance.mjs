import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const modules = new Map();
function loadProductionModule(name) {
  if (modules.has(name)) return modules.get(name);
  const source = fs.readFileSync(new URL("../src/lib/" + name + ".ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  modules.set(name, module.exports);
  new Function("module", "exports", "require", compiled)(module, module.exports, (id) =>
    id.startsWith("@/lib/") ? loadProductionModule(id.slice(6)) : require(id),
  );
  return module.exports;
}

const { normalizeCompanionsCount, countMeetingAttendance } = loadProductionModule("meetings-ledger");
const routeSource = fs.readFileSync(new URL("../src/routes/_authenticated/meetings.tsx", import.meta.url), "utf8");
const start = routeSource.indexOf("  const setRsvp = ");
const end = routeSource.indexOf("  const handleRemindAll = ", start);
assert.ok(start >= 0 && end > start, "production RSVP handler must be present");
const handlerSource = ts.transpileModule(routeSource.slice(start, end) + "\nglobalThis.handler = setRsvp;", {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

function row(userId, companions = 0, rsvp = "going") {
  return { meeting_id: "meeting-1", user_id: userId, rsvp, companions_count: companions };
}

// Exercise the actual route handler against a database boundary, including errors
// and server readback. This catches the old retry that silently discarded counts.
function fixture({ rows = [row("member-1"), row("member-2")], error = null, readbackCount } = {}) {
  let persisted = structuredClone(rows);
  const writes = [];
  const successes = [];
  const errors = [];
  const context = {
    userId: "member-1",
    attendees: structuredClone(rows),
    savingRsvp: null,
    normalizeCompanionsCount,
    console: { error() {} },
    toast: { success: (message) => successes.push(message), error: (message) => errors.push(message) },
    setSavingRsvp: (id) => { context.savingRsvp = id; },
    setAttendees: (value) => { context.attendees = typeof value === "function" ? value(context.attendees) : value; },
    supabase: {
      from(table) {
        assert.equal(table, "meeting_attendees");
        return {
          upsert(payload, options) {
            assert.equal(options.onConflict, "meeting_id,user_id");
            writes.push({ operation: "upsert", payload: JSON.parse(JSON.stringify(payload)) });
            return {
              select(columns) {
                assert.equal(columns, "*");
                return {
                  async single() {
                    if (error) return { data: null, error };
                    const saved = { ...payload, companions_count: readbackCount ?? payload.companions_count };
                    persisted = [...persisted.filter((a) => !(a.meeting_id === payload.meeting_id && a.user_id === payload.user_id)), saved];
                    return { data: structuredClone(saved), error: null };
                  },
                };
              },
            };
          },
          delete() {
            const filters = {};
            const query = {
              eq(key, value) { filters[key] = value; return query; },
              then(resolve) {
                writes.push({ operation: "delete", filters });
                if (!error) persisted = persisted.filter((a) => !(a.meeting_id === filters.meeting_id && a.user_id === filters.user_id));
                return Promise.resolve({ error }).then(resolve);
              },
            };
            return query;
          },
        };
      },
    },
  };
  vm.runInNewContext(handlerSource, context);
  return { context, writes, successes, errors, reload: () => structuredClone(persisted) };
}

test("adding five companions increases two confirmed attendees to seven", async () => {
  const f = fixture();
  assert.equal(countMeetingAttendance(f.context.attendees), 2);
  const saving = f.context.handler("meeting-1", "going", 5, "companions");
  assert.equal(countMeetingAttendance(f.context.attendees), 7, "the optimistic total updates immediately");
  await saving;
  assert.equal(countMeetingAttendance(f.context.attendees), 7);
  assert.equal(f.writes[0].payload.companions_count, 5);
  assert.equal(f.writes.length, 1);
  assert.equal(f.successes.length, 1);
  assert.equal(f.errors.length, 0);
  assert.equal(f.context.savingRsvp, null);
});

test("saved companions remain included after a server reload", async () => {
  const f = fixture({ rows: [row("member-1"), row("member-2"), row("declined", 9, "not_going"), row("pending", 4, "maybe")] });
  await f.context.handler("meeting-1", "going", 5, "companions");
  const reloaded = f.reload();
  assert.equal(reloaded.find((a) => a.user_id === "member-1").companions_count, 5);
  assert.equal(countMeetingAttendance(reloaded), 7);
});

test("lowering or clearing companions updates the total without cancelling attendance", async () => {
  const f = fixture({ rows: [row("member-1", 5), row("member-2")] });
  await f.context.handler("meeting-1", "going", 2, "companions");
  assert.equal(countMeetingAttendance(f.context.attendees), 4);
  await f.context.handler("meeting-1", "going", 0, "companions");
  assert.equal(countMeetingAttendance(f.context.attendees), 2);
  assert.equal(f.context.attendees.find((a) => a.user_id === "member-1").rsvp, "going");
  assert.ok(f.writes.every((write) => write.operation === "upsert"));
});

test("a repeated companion save cannot toggle attendance off", async () => {
  const f = fixture({ rows: [row("member-1", 5), row("member-2")] });
  await f.context.handler("meeting-1", "going", 5, "companions");
  assert.equal(countMeetingAttendance(f.context.attendees), 7);
  assert.equal(f.writes.length, 0);
});

test("the existing attendance-choice toggle still removes only the member's RSVP", async () => {
  const f = fixture({ rows: [row("member-1", 5), row("member-2")] });
  await f.context.handler("meeting-1", "going", 5);
  assert.equal(countMeetingAttendance(f.context.attendees), 1);
  assert.equal(countMeetingAttendance(f.reload()), 1);
  assert.equal(f.writes[0].operation, "delete");
  assert.equal(f.writes[0].filters.user_id, "member-1");
  assert.equal(f.context.attendees[0].user_id, "member-2");
});

test("declining removes the member and companions from the confirmed total", async () => {
  const f = fixture({ rows: [row("member-1", 5), row("member-2")] });
  await f.context.handler("meeting-1", "not_going");
  assert.equal(countMeetingAttendance(f.context.attendees), 1);
  assert.equal(f.reload().find((a) => a.user_id === "member-1").companions_count, 0);
});

test("a missing companion column fails visibly and never retries without the count", async () => {
  const f = fixture({ error: { code: "PGRST204", message: "Could not find the companions_count column" } });
  await f.context.handler("meeting-1", "going", 5, "companions");
  assert.equal(countMeetingAttendance(f.context.attendees), 2);
  assert.equal(countMeetingAttendance(f.reload()), 2);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].payload.companions_count, 5);
  assert.equal(f.successes.length, 0);
  assert.equal(f.errors.length, 1);
  assert.equal(f.context.savingRsvp, null);
});

test("incorrect server readback cannot report a companion save as successful", async () => {
  const f = fixture({ readbackCount: 0 });
  await f.context.handler("meeting-1", "going", 5, "companions");
  assert.equal(countMeetingAttendance(f.context.attendees), 2);
  assert.equal(f.successes.length, 0);
  assert.equal(f.errors.length, 1);
});

test("companion edits do not confirm attendance for a declined member", async () => {
  const f = fixture({ rows: [row("member-1", 0, "not_going"), row("member-2")] });
  await f.context.handler("meeting-1", "going", 5, "companions");
  assert.equal(countMeetingAttendance(f.context.attendees), 1);
  assert.equal(f.writes.length, 0);
});

test("signed-out members cannot save another RSVP", async () => {
  const f = fixture();
  f.context.userId = null;
  await f.context.handler("meeting-1", "going", 5, "companions");
  assert.equal(countMeetingAttendance(f.context.attendees), 2);
  assert.equal(f.writes.length, 0);
});

test("missing or invalid companion values cannot corrupt confirmed totals", () => {
  for (const value of [undefined, null, -5, NaN, Infinity]) assert.equal(normalizeCompanionsCount(value), 0);
  assert.equal(normalizeCompanionsCount(5), 5);
  assert.equal(normalizeCompanionsCount(2.9), 2);
  assert.equal(countMeetingAttendance([row("one", undefined), row("two", -5), row("three", 8, "not_going")]), 2);
});
