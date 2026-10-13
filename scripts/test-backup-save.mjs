import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const source = fs.readFileSync(new URL("src/lib/save-backup.ts", root), "utf8");
const uiSource = fs.readFileSync(new URL("src/components/admin/system-backup.tsx", root), "utf8");
const backup = {
  fileName: "alsaif-backup-2026-10-13T09-33-05.zip",
  zipBase64: "UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==", // Valid, empty ZIP archive.
  rowsCount: 1096,
  bytesSize: 22,
};

function saver({ native = false, available = true, save = async () => ({ saved: true }), picker, clickError } = {}) {
  const events = { nativeCalls: [], revocations: [], timers: [], links: [], pluginNames: [] };
  const js = stripTypeScriptTypes(source)
    .replace(/import[^\n]+from "@capacitor\/core";\n/, "")
    .replace("export async function", "async function");
  const saveBackupFile = vm.runInNewContext(`${js}\nsaveBackupFile;`, {
    Capacitor: { isNativePlatform: () => native, isPluginAvailable: () => available },
    registerPlugin: (name) => {
      events.pluginNames.push(name);
      return { save: (options) => { events.nativeCalls.push(options); return save(options); } };
    },
    window: { showSaveFilePicker: picker },
    atob,
    Uint8Array,
    Blob,
    URL: {
      createObjectURL: (blob) => { events.blob = blob; return "blob:test-backup"; },
      revokeObjectURL: (url) => events.revocations.push(url),
    },
    document: {
      createElement: () => {
        const link = { clicks: 0, removed: false, click() { this.clicks++; if (clickError) throw clickError; }, remove() { this.removed = true; } };
        events.links.push(link);
        return link;
      },
      body: { appendChild: () => {} },
    },
    setTimeout: (callback, delay) => events.timers.push({ callback, delay }),
  });
  return { saveBackupFile, events };
}

test("Android passes the ZIP to the native saver and waits for completion", async () => {
  let finish;
  const { saveBackupFile, events } = saver({ native: true, save: () => new Promise((resolve) => { finish = resolve; }) });
  let settled = false;
  const result = saveBackupFile(backup).then((outcome) => { settled = true; return outcome; });
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(events.nativeCalls[0].fileName, backup.fileName);
  assert.equal(events.nativeCalls[0].base64Data, backup.zipBase64);
  finish({ saved: true });
  assert.equal(await result, "saved");
  assert.equal(events.links.length, 0);
});

test("cancelling the Android picker does not report a saved file", async () => {
  const { saveBackupFile, events } = saver({ native: true, save: async () => ({ saved: false }) });
  assert.equal(await saveBackupFile(backup), "cancelled");
  assert.equal(events.links.length, 0);
});

test("native write failures propagate without attempting a broken WebView download", async () => {
  const failure = new Error("Selected document is not writable");
  const { saveBackupFile, events } = saver({ native: true, save: async () => { throw failure; } });
  await assert.rejects(saveBackupFile(backup), (error) => error === failure);
  assert.equal(events.links.length, 0);
});

test("older APKs explain the required update instead of claiming download success", async () => {
  const { saveBackupFile, events } = saver({ native: true, available: false });
  await assert.rejects(saveBackupFile(backup), /حدّث التطبيق/);
  assert.equal(events.nativeCalls.length, 0);
  assert.equal(events.links.length, 0);
});

test("the web file picker writes the exact ZIP and closes before reporting saved", async () => {
  const calls = [];
  const { saveBackupFile } = saver({ picker: async (options) => {
    assert.equal(options.suggestedName, backup.fileName);
    return { createWritable: async () => ({
      write: async (blob) => { calls.push("write"); assert.equal(blob.type, "application/zip"); assert.equal(Buffer.from(await blob.arrayBuffer()).toString("base64"), backup.zipBase64); },
      close: async () => calls.push("close"),
      abort: async () => calls.push("abort"),
    }) };
  } });
  assert.equal(await saveBackupFile(backup), "saved");
  assert.deepEqual(calls, ["write", "close"]);
});

test("cancelling a web picker does not trigger a second download", async () => {
  const { saveBackupFile, events } = saver({ picker: async () => { throw { name: "AbortError" }; } });
  assert.equal(await saveBackupFile(backup), "cancelled");
  assert.equal(events.links.length, 0);
});

test("web write errors abort the incomplete file and remain errors", async () => {
  let aborted = false;
  const failure = new Error("Disk full");
  const { saveBackupFile, events } = saver({ picker: async () => ({ createWritable: async () => ({
    write: async () => { throw failure; }, close: async () => assert.fail("must not close a failed write"), abort: async () => { aborted = true; },
  }) }) });
  await assert.rejects(saveBackupFile(backup), (error) => error === failure);
  assert.equal(aborted, true);
  assert.equal(events.links.length, 0);
});

test("a preview's blocked file picker falls back to a browser download", async () => {
  const { saveBackupFile, events } = saver({ picker: async () => { throw { name: "SecurityError" }; } });
  assert.equal(await saveBackupFile(backup), "download-started");
  assert.equal(events.links[0].clicks, 1);
});

test("browser download keeps its blob alive and never claims a confirmed save", async () => {
  const { saveBackupFile, events } = saver();
  assert.equal(await saveBackupFile(backup), "download-started");
  assert.equal(events.links[0].download, backup.fileName);
  assert.equal(events.links[0].href, "blob:test-backup");
  assert.equal(events.links[0].removed, false);
  assert.equal(events.revocations.length, 0);
  assert.equal(Buffer.from(await events.blob.arrayBuffer()).toString("base64"), backup.zipBase64);
  assert.equal(events.timers[0].delay, 60_000);
  events.timers[0].callback();
  assert.equal(events.links[0].removed, true);
  assert.deepEqual(events.revocations, ["blob:test-backup"]);
});

test("a failed browser click cleans up and remains a failure", async () => {
  const failure = new Error("Download blocked");
  const { saveBackupFile, events } = saver({ clickError: failure });
  await assert.rejects(saveBackupFile(backup), (error) => error === failure);
  assert.equal(events.links[0].removed, true);
  assert.equal(events.revocations.length, 1);
  assert.equal(events.timers.length, 0);
});

function pageActions({ readyBackup = null, outcome = "saved", exportError, saveError, saving = false } = {}) {
  const start = uiSource.indexOf("  const handleBackup =");
  const end = uiSource.indexOf("\n  return (", start);
  assert.ok(start >= 0 && end > start);
  const actions = stripTypeScriptTypes(uiSource.slice(start, end));
  const state = { readyBackup, saving, busy: false, password: "test-password", exports: 0, saves: 0, messages: [], outcome, saveError };
  const context = {
    get password() { return state.password; }, get busy() { return state.busy; },
    get saving() { return state.saving; }, get readyBackup() { return state.readyBackup; },
    setPassword: (value) => { state.password = value; }, setBusy: (value) => { state.busy = value; },
    setSaving: (value) => { state.saving = value; }, setReadyBackup: (value) => { state.readyBackup = value; },
    supabase: { auth: { getUser: async () => ({ data: { user: { email: "admin@example.test" } } }), signInWithPassword: async () => ({ error: null }) } },
    runBackup: async () => { state.exports++; if (exportError) throw exportError; return backup; },
    saveBackupFile: async (file) => { state.saves++; assert.equal(file, state.readyBackup); if (state.saveError) throw state.saveError; return state.outcome; },
    loadHistory: async () => {},
    toast: Object.fromEntries(["info", "success", "error"].map((kind) => [kind, (message) => state.messages.push({ kind, message })])),
  };
  return { ...vm.runInNewContext(`${actions}\n({ handleBackup, handleSave });`, context), state };
}

test("generating a backup retains its ZIP without claiming it was downloaded", async () => {
  const { handleBackup, state } = pageActions();
  await handleBackup();
  assert.equal(state.readyBackup, backup);
  assert.equal(state.password, "");
  assert.equal(state.exports, 1);
  assert.equal(state.saves, 0);
  assert.equal(state.busy, false);
  assert.equal(state.messages.some((m) => m.kind === "success"), false);
});

test("cancelled saves can retry the same generated backup without exporting again", async () => {
  const { handleSave, state } = pageActions({ readyBackup: backup, outcome: "cancelled" });
  await handleSave();
  assert.equal(state.readyBackup, backup);
  assert.equal(state.saving, false);
  assert.equal(state.messages.some((m) => m.kind === "success"), false);
  state.outcome = "saved";
  await handleSave();
  assert.equal(state.saves, 2);
  assert.equal(state.exports, 0);
  assert.equal(state.messages.at(-1).kind, "success");
});

test("save errors retain the ZIP and allow another save attempt", async () => {
  const { handleSave, state } = pageActions({ readyBackup: backup, saveError: new Error("Storage unavailable") });
  await handleSave();
  assert.equal(state.readyBackup, backup);
  assert.equal(state.messages.at(-1).kind, "error");
  state.saveError = null;
  await handleSave();
  assert.equal(state.messages.at(-1).kind, "success");
  assert.equal(state.exports, 0);
});

test("a save in progress blocks both additional saves and another export", async () => {
  const { handleBackup, handleSave, state } = pageActions({ readyBackup: backup, saving: true });
  await handleBackup();
  await handleSave();
  assert.equal(state.saves, 0);
  assert.equal(state.exports, 0);
});

test("a failed replacement export keeps the previously prepared file", async () => {
  const { handleBackup, state } = pageActions({ readyBackup: backup, exportError: new Error("Server unavailable") });
  await handleBackup();
  assert.equal(state.readyBackup, backup);
  assert.equal(state.messages.at(-1).kind, "error");
  assert.equal(state.saves, 0);
});

test("the Java saver and activity registration match the web bridge name", () => {
  const java = fs.readFileSync(new URL("android/app/src/main/java/com/alsaif/familyhub/FileSavePlugin.java", root), "utf8");
  const activity = fs.readFileSync(new URL("android/app/src/main/java/com/alsaif/familyhub/MainActivity.java", root), "utf8");
  const { events } = saver();
  assert.equal(events.pluginNames[0], /@CapacitorPlugin\(name = "([^"]+)"\)/.exec(java)[1]);
  assert.match(java, /@PluginMethod\s+public void save\(PluginCall call\)/);
  const registration = activity.indexOf("registerPlugin(FileSavePlugin.class)");
  assert.ok(registration >= 0 && registration < activity.indexOf("super.onCreate(savedInstanceState)"));
});
