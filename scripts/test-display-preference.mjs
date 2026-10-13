import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

const source = ["display-preference", "desktop-media", "display-layout"].map(name =>
  stripTypeScriptTypes(readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), "utf8"))
    .replace(/^import .*;\n/gm, "").replace(/^export /gm, ""),
).join("\n");

function harness({ width = 425, height = 900, touch = true, initial = {}, blocked = false, quota = false } = {}) {
  const storage = new Map(Object.entries(initial));
  const window = new EventTarget();
  Object.assign(window, { innerWidth: width, innerHeight: height, matchMedia: () => ({ matches: touch }) });
  const properties = new Map();
  const head = {};
  const document = new EventTarget();
  Object.assign(document, { head, styleSheets: [], documentElement: { clientWidth: width, dataset: {}, style: {
    setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key),
  } } });
  let mutation;
  let pending;
  const context = {
    window, document, navigator: { maxTouchPoints: touch ? 5 : 0 }, Event,
    localStorage: {
      getItem(key) { if (blocked) throw Error("blocked"); return storage.get(key) ?? null; },
      setItem(key, value) { if (blocked || quota) throw Error("full"); storage.set(key, value); },
      removeItem(key) { if (blocked || quota) throw Error("blocked"); storage.delete(key); },
    },
    MutationObserver: class {
      constructor(callback) { mutation = callback; }
      observe() {} disconnect() { mutation = null; }
    },
    requestAnimationFrame: callback => { pending = callback; return 1; },
    cancelAnimationFrame: () => { pending = null; },
  };
  vm.runInNewContext(source + "\nglobalThis.api = {getDisplayMode, saveDisplayMode, subscribeDisplayMode, getDisplayViewport, getDisplayScale, desktopMediaQuery, desktopViewportValues, mountDisplayLayout};", context);
  const event = (type, key) => { const e = new Event(type); if (key !== undefined) e.key = key; window.dispatchEvent(e); };
  return { api: context.api, context, window, document, storage, properties, event,
    mutate: () => { mutation?.(); const next = pending; pending = null; next?.(); } };
}

test("automatic is the default and preserves the actual phone/tablet/desktop viewport", () => {
  for (const [width, height, touch] of [[425, 900, true], [834, 1194, true], [1440, 900, false]]) {
    const h = harness({ width, height, touch });
    assert.equal(h.api.getDisplayMode(), "auto");
    assert.equal(JSON.stringify(h.api.getDisplayViewport()), JSON.stringify({ width, height, touch }));
    assert.equal(h.api.getDisplayScale(), 1);
  }
});

test("explicit desktop wins over portrait/touch and Chrome's 980px desktop viewport", () => {
  for (const width of [390, 425, 834, 980, 1194]) {
    const h = harness({ width, height: 2200 });
    h.api.saveDisplayMode("desktop");
    assert.equal(h.api.getDisplayViewport().width, 1440);
    assert.equal(h.api.getDisplayViewport().touch, false);
    assert.equal(h.api.getDisplayViewport().height, 900);
    assert.equal(h.api.getDisplayScale(), width / 1440);
  }
});

test("desktop does not enlarge an already wide computer screen", () => {
  const h = harness({ width: 1920, initial: { "alsaif-display-mode": "desktop" } });
  assert.equal(h.api.getDisplayViewport().width, 1920);
  assert.equal(h.api.getDisplayScale(), 1);
});

test("the choice survives reload and returning to auto preserves other preferences", () => {
  const h = harness({ initial: { theme: "dark", "app-font-id": "Tajawal" } });
  assert.equal(h.api.saveDisplayMode("desktop"), true);
  const reload = harness({ initial: Object.fromEntries(h.storage) });
  assert.equal(reload.api.getDisplayMode(), "desktop");
  reload.api.saveDisplayMode("auto");
  assert.equal(reload.api.getDisplayMode(), "auto");
  assert.equal(reload.storage.get("theme"), "dark");
  assert.equal(reload.storage.get("app-font-id"), "Tajawal");
});

test("blocked storage and exhausted quota still allow switching for the current session", () => {
  for (const options of [{ blocked: true }, { quota: true }]) {
    const h = harness(options);
    assert.equal(h.api.saveDisplayMode("desktop"), false);
    assert.equal(h.api.getDisplayMode(), "desktop");
    h.api.saveDisplayMode("auto");
    assert.equal(h.api.getDisplayMode(), "auto");
  }
});

test("subscription follows this-device changes and relevant cross-tab updates only", () => {
  const h = harness(); let calls = 0;
  const unsubscribe = h.api.subscribeDisplayMode(() => calls++);
  h.api.saveDisplayMode("desktop");
  h.event("storage", "theme");
  h.event("storage", "alsaif-display-mode");
  h.event("storage", null);
  assert.equal(calls, 3);
  unsubscribe(); h.api.saveDisplayMode("auto"); assert.equal(calls, 3);
});

test("server rendering uses auto without accessing browser APIs", () => {
  const c = {}; vm.runInNewContext(source + "\nglobalThis.mode = getDisplayMode();", c);
  assert.equal(c.mode, "auto");
});

test("desktop media handles px/rem bounds, Tailwind ranges and portrait overrides", () => {
  const { api } = harness();
  assert.equal(api.desktopMediaQuery("(width >= 64rem)", 1440), "(min-width: 0px)");
  assert.equal(api.desktopMediaQuery("(width < 48rem)", 1440), "(max-width: 0px)");
  assert.equal(api.desktopMediaQuery("(max-width: 969.98px)", 1440), "(max-width: 0px)");
  assert.equal(api.desktopMediaQuery("(min-width:970px) and (max-width:1600px) and (orientation:portrait)", 1440), "(min-width: 0px) and (min-width: 0px) and (max-width: 0px)");
  assert.equal(api.desktopMediaQuery("(min-width:970px) and (orientation:landscape) and (pointer:coarse)", 1440), "(min-width: 0px) and (min-width: 0px) and (max-width: 0px)");
});

test("reduced motion, dark mode, print and standalone touch capabilities stay native", () => {
  const { api } = harness();
  for (const query of ["(prefers-reduced-motion: reduce)", "(prefers-color-scheme: dark)", "print", "(hover: none), (pointer: coarse)"]) {
    assert.equal(api.desktopMediaQuery(query, 1440), query);
  }
  assert.equal(api.desktopMediaQuery("screen and (width >= 40em) and (prefers-reduced-motion: reduce)", 1440), "screen and (min-width: 0px) and (prefers-reduced-motion: reduce)");
});

test("viewport lengths follow the canvas without altering image URLs or quoted content", () => {
  const { api } = harness();
  assert.equal(api.desktopViewportValues('width: 100vw; height: calc(100dvh - 10px); content: "30vh"; background: url("icon50vw.svg");'),
    'width: calc(100 * var(--display-vw)); height: calc(calc(100 * var(--display-vh)) - 10px); content: "30vh"; background: url("icon50vw.svg");');
});

test("enabling and reverting restores the exact original media and CSS declarations", () => {
  const h = harness();
  const rule = { media: { mediaText: "(min-width: 1200px)" }, cssRules: [
    { style: { cssText: "width: 40vw !important; height: 100dvh;" } },
  ] };
  h.document.styleSheets.push({ cssRules: [rule] });
  const cleanup = h.api.mountDisplayLayout();
  assert.equal(rule.media.mediaText, "(min-width: 1200px)");
  h.api.saveDisplayMode("desktop");
  assert.equal(h.document.documentElement.dataset.displayMode, "desktop");
  assert.equal(rule.media.mediaText, "(min-width: 0px)");
  assert.equal(rule.cssRules[0].style.cssText, "width: calc(40 * var(--display-vw)) !important; height: calc(100 * var(--display-vh));");
  assert.equal(h.properties.get("--display-scale"), String(425 / 1440));
  h.api.saveDisplayMode("auto");
  assert.equal(rule.media.mediaText, "(min-width: 1200px)");
  assert.equal(rule.cssRules[0].style.cssText, "width: 40vw !important; height: 100dvh;");
  assert.equal(h.document.documentElement.dataset.displayMode, undefined);
  assert.equal(h.properties.size, 0);
  cleanup();
});

test("late-loaded route styles and nested layers join desktop mode; cleanup restores them", () => {
  const h = harness({ initial: { "alsaif-display-mode": "desktop" } });
  const cleanup = h.api.mountDisplayLayout();
  const later = { cssRules: [{ media: { mediaText: "(max-width: 600px)" } }] };
  h.document.styleSheets.push({ cssRules: [later] });
  h.document.styleSheets.push({ get cssRules() { throw Error("external font"); } });
  h.mutate();
  assert.equal(later.cssRules[0].media.mediaText, "(max-width: 0px)");
  cleanup();
  assert.equal(later.cssRules[0].media.mediaText, "(max-width: 600px)");
});
