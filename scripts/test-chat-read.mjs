import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/lib/chat-read.ts", import.meta.url), "utf8");
const oldTime = "2026-10-13T10:00:00.000000+00:00";
const seenTime = "2026-10-13T10:00:01.123456+00:00";
const message = (id, created_at = seenTime, sender_id = "other", conversation_id = "chat", kind = "text") =>
  ({ id, created_at, sender_id, conversation_id, kind });

function fixture({ initialRead = oldTime, denied = false, zeroRows = false, receiptFailure = false, gate } = {}) {
  const queries = [], events = [], timers = [], effects = [];
  const control = { cursor: initialRead, denied, zeroRows, receiptFailure, gate };
  const documentListeners = new Map(), windowListeners = new Map();
  const document = {
    visibilityState: "visible",
    addEventListener: (name, callback) => documentListeners.set(name, callback),
    removeEventListener: (name) => documentListeners.delete(name),
  };
  const js = stripTypeScriptTypes(source)
    .replace(/^import[^;]+;\n/gm, "")
    .replaceAll("export ", "");
  const api = vm.runInNewContext(`${js}\n({ compareChatTime, effectiveLastReadAt, isUnreadChatMessage, markConversationRead, useConversationRead });`, {
    useEffect: (callback) => effects.push(callback()),
    document,
    window: {
      dispatchEvent: (event) => events.push(event),
      addEventListener: (name, callback) => windowListeners.set(name, callback),
      removeEventListener: (name) => windowListeners.delete(name),
    },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    setTimeout: (callback, delay) => { const timer = { callback, delay }; timers.push(timer); return timer; },
    clearTimeout: (timer) => { timer.cleared = true; },
  });
  const client = {
    from(table) {
      const query = { table, action: "select", filters: [] };
      const builder = {
        update(data) { query.action = "update"; query.data = data; return builder; },
        upsert(data, options) { query.action = "upsert"; query.data = data; query.options = options; return builder; },
        eq(name, value) { query.filters.push([name, value]); return builder; },
        or(value) { query.condition = value; return builder; },
        select(columns) { query.columns = columns; return builder; },
        maybeSingle() { return builder; },
        // Like Postgrest, nothing executes until the builder is awaited/then'ed.
        then(resolve, reject) {
          return Promise.resolve().then(async () => {
            queries.push(query);
            if (control.gate) await control.gate;
            if (query.table === "conversation_participants") {
              if (query.action === "update") {
                if (control.denied) return { data: null, error: new Error("Denied") };
                if (control.zeroRows || api.compareChatTime(control.cursor, query.data.last_read_at) >= 0) {
                  return { data: null, error: null };
                }
                control.cursor = query.data.last_read_at;
              }
              return { data: { last_read_at: control.cursor }, error: null };
            }
            if (control.receiptFailure) return { data: null, error: new Error("Receipts unavailable") };
            return { data: null, error: null };
          }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { api, client, control, queries, events, document, documentListeners, windowListeners, timers, effects };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("opening chat persists its cursor and executes the lazy read-receipt query", async () => {
  const f = fixture();
  await f.api.markConversationRead(f.client, "me", "chat", [message("audio", seenTime, "other", "chat", "audio")]);
  assert.equal(f.control.cursor, seenTime);
  assert.equal(f.queries.length, 2);
  assert.deepEqual(f.queries[0].filters.map((x) => [...x]), [["conversation_id", "chat"], ["user_id", "me"]]);
  assert.equal(f.queries[1].data[0].message_id, "audio");
  assert.equal(f.queries[1].data[0].user_id, "me");
  assert.equal(f.api.isUnreadChatMessage(message("audio"), "me", oldTime), false);
  assert.equal(f.events[0].type, "chat:read-confirmed");
});

test("receipt writes include inbound media but exclude own messages and other conversations", async () => {
  const f = fixture();
  await f.api.markConversationRead(f.client, "me", "chat", [
    message("voice", oldTime, "other", "chat", "audio"),
    message("file", seenTime, "other", "chat", "file"),
    message("own", seenTime, "me"), message("elsewhere", seenTime, "other", "different"),
  ]);
  assert.deepEqual(Array.from(f.queries[1].data, (row) => row.message_id), ["voice", "file"]);
  assert.equal(f.api.isUnreadChatMessage(message("own", seenTime, "me"), "me", oldTime), false);
});

test("a later incoming message remains unread during an earlier read acknowledgement", async () => {
  const f = fixture();
  await f.api.markConversationRead(f.client, "me", "chat", [message("seen")]);
  const later = message("new", "2026-10-13T10:00:01.123457+00:00");
  assert.equal(f.api.isUnreadChatMessage(later, "me", oldTime), true);
  assert.equal(f.control.cursor, seenTime);
});

test("timestamp comparisons preserve microseconds and normalize timezone offsets", () => {
  const { api } = fixture();
  assert.equal(api.compareChatTime(seenTime, "2026-10-13T13:00:01.123456+03:00"), 0);
  assert.equal(api.compareChatTime("2026-10-13T10:00:01.123457Z", seenTime), 1);
  assert.equal(api.compareChatTime(seenTime, null), 1);
  assert.equal(api.compareChatTime(null, "invalid"), 0);
});

test("another device's newer cursor is verified and never moved backwards", async () => {
  const newer = "2026-10-13T10:00:02.000000Z";
  const f = fixture({ initialRead: newer });
  await f.api.markConversationRead(f.client, "me", "chat", [message("seen")]);
  assert.equal(f.control.cursor, newer);
  assert.equal(f.queries[0].condition, `last_read_at.is.null,last_read_at.lt.${seenTime}`);
  assert.equal(f.queries[1].action, "select");
  assert.equal(f.events[0].detail.readAt, newer);
});

test("failed participant writes never clear the badge or acknowledge receipts", async () => {
  const f = fixture({ denied: true });
  await assert.rejects(f.api.markConversationRead(f.client, "me", "chat", [message("seen")]));
  assert.equal(f.events.length, 0);
  assert.equal(f.queries.length, 1);
  assert.equal(f.api.isUnreadChatMessage(message("seen"), "me", oldTime), true);
});

test("an RLS-filtered zero-row update cannot falsely acknowledge an old cursor", async () => {
  const f = fixture({ zeroRows: true });
  await assert.rejects(f.api.markConversationRead(f.client, "me", "chat", [message("seen")]));
  assert.equal(f.events.length, 0);
  assert.equal(f.api.effectiveLastReadAt("me", "chat", oldTime), oldTime);
});

test("failed receipts remain retryable after the badge cursor was persisted", async () => {
  const f = fixture({ receiptFailure: true });
  await assert.rejects(f.api.markConversationRead(f.client, "me", "chat", [message("seen")]));
  assert.equal(f.api.isUnreadChatMessage(message("seen"), "me", oldTime), false);
  f.control.receiptFailure = false;
  await f.api.markConversationRead(f.client, "me", "chat", [message("seen")]);
  assert.equal(f.queries.filter((q) => q.action === "upsert").length, 2);
  assert.equal(f.queries.filter((q) => q.action === "update").length, 1);
});

test("repeated concurrent snapshots share confirmed reads without duplicate writes", async () => {
  const f = fixture();
  await Promise.all([
    f.api.markConversationRead(f.client, "me", "chat", [message("seen")]),
    f.api.markConversationRead(f.client, "me", "chat", [message("seen")]),
  ]);
  assert.equal(f.queries.length, 2);
  assert.equal(f.events.length, 1);
});

test("confirmed watermarks are scoped to both user and conversation", async () => {
  const f = fixture();
  await f.api.markConversationRead(f.client, "me", "chat", [message("seen")]);
  assert.equal(f.api.isUnreadChatMessage(message("seen"), "another-user", oldTime), true);
  assert.equal(f.api.isUnreadChatMessage(message("different", seenTime, "other", "elsewhere"), "me", oldTime), true);
});

test("a stale snapshot from the previous route cannot mark a new conversation", async () => {
  const f = fixture();
  await f.api.markConversationRead(f.client, "me", "new-chat", [message("old-thread")]);
  assert.equal(f.queries.length, 0);
});

test("background messages are marked only when the conversation becomes visible", async () => {
  const f = fixture();
  f.document.visibilityState = "hidden";
  f.api.useConversationRead(f.client, "me", "chat", [message("seen")], [], true);
  await flush();
  assert.equal(f.queries.length, 0);
  f.document.visibilityState = "visible";
  f.documentListeners.get("visibilitychange")();
  await flush();
  assert.equal(f.queries.length, 2);
});

test("quickly leaving an observed conversation does not cancel its saved read state", async () => {
  let release;
  const f = fixture({ gate: new Promise((resolve) => { release = resolve; }) });
  f.api.useConversationRead(f.client, "me", "chat", [message("seen")], [], true);
  f.effects[0]();
  release();
  await flush();
  assert.equal(f.control.cursor, seenTime);
  assert.equal(f.events.length, 1);
  assert.equal(f.documentListeners.size, 0);
});

test("reconnecting retries a failed read without requiring another message", async () => {
  const f = fixture({ denied: true });
  f.api.useConversationRead(f.client, "me", "chat", [message("seen")], [], true);
  await flush();
  assert.equal(f.timers[0].delay, 2000);
  f.control.denied = false;
  f.windowListeners.get("online")();
  await flush();
  assert.equal(f.control.cursor, seenTime);
  assert.equal(f.timers[0].cleared, true);
});

test("an unloaded conversation or missing actor never records reads", async () => {
  const f = fixture();
  f.api.useConversationRead(f.client, "me", "chat", [message("seen")], [], false);
  f.api.useConversationRead(f.client, null, "chat", [message("seen")], [], true);
  await flush();
  assert.equal(f.queries.length, 0);
});
