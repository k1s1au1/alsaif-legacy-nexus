import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdtempSync, rmSync, globSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { build } from "esbuild";

// Exercise the real dashboard component with native touch input in CI's Chrome.
// Local --prepare-only only compiles the fixture; it starts no server or browser.
const prepareOnly = process.argv.includes("--prepare-only");
const chromePath =
  process.env.CHROME_PATH ||
  ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find(existsSync);
if (!chromePath && !prepareOnly) throw Error("Preinstalled Chrome is required for swipe checks");
const temporary = mkdtempSync(join(tmpdir(), "alsaif-followup-touch-"));
const output = join(temporary, "assets");
const compiled = [...globSync(".output/public/**/styles-*.css")];
assert.ok(compiled.length, "Build the app before its component checks");
const root = readFileSync("src/routes/__root.tsx", "utf8");
const imports = new Map(
  [...root.matchAll(/import (\w+) from "\.\.\/([^"?]+\.css)\?url";/g)].map((m) => [
    m[1],
    `src/${m[2]}`,
  ]),
);
const readStyles = (path) =>
  readFileSync(path, "utf8").replace(/@import\s+["']([^"']+\.css)["'];/g, (_, relative) =>
    readStyles(resolve(dirname(path), relative)),
  );
const ordered = [...root.matchAll(/href:(\w+Css)/g)].map((m) => imports.get(m[1])).filter(Boolean);
const css = [
  readFileSync(compiled[0], "utf8"),
  ...ordered.filter((p) => p !== "src/styles.css").map(readStyles),
].join("\n");
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {ResponsiveDashboardExtras} from './src/components/dashboard/desktop-dashboard-extras';
window.qaInputTrace=[];for(const type of ['touchstart','touchend','touchcancel','click'])document.addEventListener(type,event=>{const point=event.touches?.[0]||event.changedTouches?.[0];const item={type,trusted:event.isTrusted,target:event.target.tagName,link:event.target.closest?.('a')?.getAttribute('href'),x:point?.clientX,y:point?.clientY};window.qaInputTrace.push(item);window.qaInputTrace=window.qaInputTrace.slice(-20);queueMicrotask(()=>item.prevented=event.defaultPrevented)},true);window.qaNativeClicks=0;document.addEventListener('click',event=>{if(event.isTrusted)window.qaNativeClicks++},true);window.qaActions=[];window.qaEvents={meetings:[{id:'meeting',title:'اجتماع العائلة',scheduled_at:'2099-01-01T17:00:00',location:'المجلس'}],tasks:[{id:'task',title:'تجهيز المجلس',due_date:'2099-01-02'}],trips:[{id:'trip',title:'رحلة العلا',status:'upcoming',location:'العلا',start_date:'2099-01-03',end_date:'2099-01-04',image_url:null},{id:'plan',title:'رحلة قيد التخطيط',status:'planning',start_date:null,end_date:null}]};window.qaAllEvents=window.qaEvents;window.qaOccasions=[];
function Fixture(){const [,render]=React.useReducer(x=>x+1,0);window.qaChangeEvents=value=>{window.qaEvents=value;render()};return <div className="relative min-h-screen overflow-x-hidden"><main className="app-shell-main"><div className="app-shell-content p-4 md:p-8 lg:p-12 mx-auto max-w-7xl"><ResponsiveDashboardExtras onReportBug={()=>{}}/></div></main><footer style={{height:1000}}/></div>}
createRoot(document.getElementById('app')).render(<Fixture/>);window.fixtureReady=true;`;
await build({
  stdin: {
    contents: entry,
    resolveDir: process.cwd(),
    sourcefile: "followup-touch-qa.tsx",
    loader: "tsx",
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  outdir: output,
  entryNames: "fixture",
  tsconfig: "tsconfig.json",
  plugins: [
    {
      name: "demo-dashboard-data",
      setup(builder) {
        const mocks = {
          "@tanstack/react-router": `import React from 'react';export function Link({to,params,search,children,...props}){const href=to?.replace('$tripId',params?.tripId||'trip');return <a {...props} href={href} onClick={e=>{e.preventDefault();window.qaActions.push(href)}}>{children}</a>}`,
          "@/hooks/use-dashboard-data": `const news=[];export const useUpcomingEvents=()=>({data:window.qaEvents});export const useDashboardAnnouncements=()=>({data:news});export const useDashboardCounts=()=>({data:{members:12,tasks:1}});export const useFundBalance=()=>({data:125000});export const useHeritageSnippet=()=>({data:null});export const useProfile=()=>({data:{realName:'عضو تجريبي'}});`,
          "@/hooks/use-dashboard-occasions": `export const useDashboardOccasions=()=>({data:window.qaOccasions});`,
          "@/hooks/use-site-logo": `export const useSiteLogo=()=>null;`,
          "@/lib/presence": `export const useRecordedVisitorCount=()=>12;`,
          "@/components/trip-image": `import React from 'react';export const TripImage=({alt})=><div role="img" aria-label={alt}/>;`,
          "@/components/dashboard/heritage-portal-3d": `export const HeritagePortal3D=()=>null;`,
          "@/components/dashboard/spiritual-quotes-widget": `export const SpiritualQuotesWidget=()=>null;`,
          "@/components/dashboard/prayer-mushaf-shortcuts": `export const PrayerMushafShortcuts=()=>null;`,
          "@/components/dashboard/family-agenda": `export const FamilyAgenda=()=>null;`,
        };
        builder.onResolve({ filter: /.*/ }, (args) =>
          mocks[args.path] ? { path: args.path, namespace: "demo" } : undefined,
        );
        builder.onLoad({ filter: /.*/, namespace: "demo" }, (args) => ({
          contents: mocks[args.path],
          loader: "jsx",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}html,body{margin:0}</style><link rel="stylesheet" href="/__qa/fixture.css"></head><body><div id="app"></div><script src="/__qa/fixture.js"></script></body></html>`;
if (prepareOnly) {
  rmSync(temporary, { recursive: true, force: true });
  console.log("Actual follow-up touch fixture compiled successfully");
  process.exit(0);
}
const server = createServer((request, response) => {
  if (request.url.startsWith("/__qa/")) {
    const path = join(output, request.url.slice(6));
    if (!path.startsWith(output) || !existsSync(path)) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.setHeader(
      "Content-Type",
      path.endsWith(".js") ? "application/javascript" : "text/css",
    );
    response.end(readFileSync(path));
    return;
  }
  response.setHeader("Content-Type", "text/html;charset=utf-8");
  response.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--remote-debugging-port=0",
    `--user-data-dir=${join(temporary, "profile")}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
let websocket;
try {
  const debuggerURL = await new Promise((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => reject(Error("Chrome start timeout")), 20000);
    chrome.stderr.on("data", (data) => {
      buffer += data;
      const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buffer);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    chrome.on("exit", (code) => {
      clearTimeout(timeout);
      reject(Error(`Chrome exited ${code}`));
    });
  });
  const debug = new URL(debuggerURL);
  const targets = await (await fetch(`http://${debug.host}/json/list`)).json();
  websocket = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const number = ++id;
      pending.set(number, { resolve, reject });
      websocket.send(JSON.stringify({ id: number, method, params }));
    });
  websocket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        message.error
          ? request.reject(Error(JSON.stringify(message.error)))
          : request.resolve(message.result);
      }
    }
    if (message.method === "Runtime.exceptionThrown")
      errors.push(message.params.exceptionDetails.text);
  });
  await new Promise((resolve) => websocket.addEventListener("open", resolve, { once: true }));
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw Error(`Timed out: ${expression}`);
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));
  const active = () =>
    evaluate(
      "Array.from(document.querySelectorAll('.desktop-follow-dots button')).findIndex(n=>n.classList.contains('active'))",
    );
  const center = async (selector = ".desktop-follow-cards > :first-child") => {
    await evaluate(
      "document.querySelector('.desktop-follow-panel').scrollIntoView({block:'center'})",
    );
    await settle();
    return evaluate(
      `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,
    );
  };
  const touch = (type, points) => send("Input.dispatchTouchEvent", { type, touchPoints: points });
  const swipe = async (dx, dy, selector, cancel = false) => {
    const p = await center(selector);
    await touch("touchStart", [{ ...p, id: 1 }]);
    for (let i = 1; i <= 6; i++) {
      await touch("touchMove", [{ x: p.x + (dx * i) / 6, y: p.y + (dy * i) / 6, id: 1 }]);
      await new Promise((resolve) => setTimeout(resolve, 18));
    }
    await touch(cancel ? "touchCancel" : "touchEnd", []);
    await settle();
  };
  const tap = async (selector) => {
    const p = await center(selector);
    const clicks = await evaluate("window.qaNativeClicks");
    // Let Chrome schedule the complete physical tap rather than injecting raw
    // down/up packets around its asynchronous gesture recognizer.
    await send("Input.synthesizeTapGesture", {
      ...p,
      duration: 50,
      tapCount: 1,
      gestureSourceType: "touch",
    });
    try {
      await until(`window.qaNativeClicks>${clicks}`);
    } catch (cause) {
      const state = await evaluate(
        `({point:${JSON.stringify(p)},viewport:{width:innerWidth,height:innerHeight,scale:visualViewport.scale,visualWidth:visualViewport.width},hit:document.elementFromPoint(${p.x},${p.y})?.outerHTML.slice(0,240),trace:window.qaInputTrace})`,
      );
      throw Error(`Native tap was not delivered for ${selector}: ${JSON.stringify(state)}`, {
        cause,
      });
    }
    await settle();
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  for (const [name, width, height] of [
    ["ipad-landscape", 1024, 768],
    ["ipad-air-landscape", 1180, 820],
    ["ipad-pro-landscape", 1366, 1024],
  ]) {
    // Each device starts with a fresh native input/viewport state. Screen metrics
    // must match the layout metrics when dispatching physical touch coordinates.
    await send("Emulation.setTouchEmulationEnabled", { enabled: false });
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      screenWidth: width,
      screenHeight: height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await send("Page.navigate", { url: `http://127.0.0.1:${port}/?device=${name}` });
    await until(
      "document.readyState==='complete' && window.fixtureReady && document.querySelector('.desktop-follow-cards')",
    );
    await send("Page.bringToFront");
    await send("Emulation.resetPageScaleFactor");
    assert.equal(
      await evaluate("document.documentElement.dataset.dashboardTabletLandscape"),
      "true",
    );
    assert.match(
      await evaluate(
        "getComputedStyle(document.querySelector('.desktop-follow-cards')).touchAction",
      ),
      /pan-y/,
    );
    assert.match(
      await evaluate(
        "getComputedStyle(document.querySelector('.desktop-follow-cards')).touchAction",
      ),
      /pinch-zoom/,
    );
    const geometry = await evaluate(
      "(()=>{const n=document.querySelector('.desktop-follow-cards'),r=n.getBoundingClientRect();return{width:r.width,height:r.height,display:getComputedStyle(n).display,columns:getComputedStyle(n).gridTemplateColumns.split(' ').length}})()",
    );
    assert.equal(geometry.display, "grid");
    assert.equal(geometry.columns, 3, "The approved three-card layout remains in place");
    await evaluate("window.qaRetainedTaskLink=document.querySelector('.followup-note--task a')");
    await swipe(130, 4);
    assert.equal(await active(), 1, `${name}: swipe right selects next in RTL`);
    assert.equal(
      await evaluate(
        "document.querySelector('.followup-note--task a')===window.qaRetainedTaskLink",
      ),
      true,
      "Visible card actions keep their DOM identity while the row advances",
    );
    assert.deepEqual(await evaluate("window.qaActions"), [], "Swiping never opens a card");
    await tap(".desktop-follow-cards a");
    await until("window.qaActions.length===1");
    assert.equal(
      await evaluate("window.qaActions.length"),
      1,
      "A fresh deliberate tap works immediately after swiping",
    );
    await swipe(-130, -4);
    assert.equal(await active(), 0, `${name}: swipe left selects previous`);
    await evaluate("document.querySelector('.desktop-follow-cards a').click()");
    assert.equal(
      await evaluate("window.qaActions.length"),
      1,
      "A ghost click immediately after a swipe is swallowed",
    );
    await swipe(-130, 0);
    assert.equal(await active(), 3, `${name}: previous wraps to the final item`);
    await swipe(130, 0);
    assert.equal(await active(), 0, `${name}: next wraps back to the first item`);
    await swipe(20, 0);
    assert.equal(await active(), 0, "Small finger movements do not turn a card");
    await swipe(130, 0, undefined, true);
    assert.equal(await active(), 0, "Canceled gestures do not turn a card");
    await center();
    const beforeY = await evaluate("scrollY");
    await swipe(0, -130);
    assert.equal(await active(), 0, "Vertical gestures do not change cards");
    assert.ok((await evaluate("scrollY")) > beforeY + 30, "Vertical page scrolling remains native");
    await swipe(65, -100);
    assert.equal(await active(), 0, "Diagonal page scrolling does not change cards");
    const p = await center();
    await touch("touchStart", [
      { x: p.x - 15, y: p.y, id: 1 },
      { x: p.x + 15, y: p.y, id: 2 },
    ]);
    await touch("touchEnd", []);
    await settle();
    assert.equal(await active(), 0, "Multi-finger input never changes the selected item");
    await tap('.desktop-follow-controls > button[aria-label="التالي"]');
    assert.equal(await active(), 1, "Existing next arrow stays active");
    await tap('.desktop-follow-controls > button[aria-label="السابق"]');
    assert.equal(await active(), 0, "Existing previous arrow stays active");
    await tap(".desktop-follow-dots button:nth-child(3)");
    assert.equal(await active(), 2, "Dots still select the requested item");
    await tap(".desktop-follow-panel .desktop-section-head > button");
    assert.equal(
      await evaluate("document.querySelectorAll('.desktop-follow-row').length"),
      4,
      "Expanded list stays available",
    );
    await tap(".desktop-follow-panel .desktop-section-head > button");
    await until("document.querySelector('.desktop-follow-cards')");
    assert.equal(await active(), 2, "Collapsing retains the selected item");
    await evaluate("window.qaChangeEvents({...window.qaAllEvents,trips:[]})");
    await until("document.querySelectorAll('.desktop-follow-dots button').length===2");
    await swipe(130, 0);
    assert.equal(await active(), 1, "Two-card rows support the same swipe controls");
    await evaluate(
      "window.qaChangeEvents({meetings:window.qaAllEvents.meetings,tasks:[],trips:[]})",
    );
    await until("document.querySelectorAll('.desktop-follow-cards > *').length===1");
    await swipe(130, 0);
    assert.equal(
      await evaluate("document.querySelectorAll('.desktop-follow-controls').length"),
      0,
      "One item never creates an empty carousel position",
    );
    await tap(".desktop-follow-cards a");
    assert.equal(
      await evaluate("window.qaActions.at(-1)"),
      "/meetings",
      "Single-card actions stay usable",
    );
    await evaluate("window.qaChangeEvents({meetings:[],tasks:[],trips:[]})");
    await until("document.querySelector('.desktop-next-empty')");
    assert.equal(
      await evaluate("document.querySelectorAll('.desktop-follow-cards').length"),
      0,
      "Empty results remain an empty state",
    );
    assert.equal(
      await evaluate("document.documentElement.scrollWidth<=innerWidth+2"),
      true,
      "No horizontal page overflow",
    );
    console.log(
      `PASS ${name}: native RTL touch, wrap, tap/click suppression, vertical scroll, cancellation, multiple fingers, arrows, dots, expanded list and changing data`,
    );
  }
  // The same component's desktop branch keeps its existing mouse/arrow interaction.
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/` });
  await until("document.querySelector('.desktop-follow-cards')");
  assert.equal(
    await evaluate("document.querySelector('.desktop-follow-cards').style.touchAction"),
    "",
  );
  await evaluate(
    "document.querySelector('.desktop-follow-controls > button[aria-label=التالي]').click()",
  );
  assert.equal(await active(), 1, "Desktop arrows retain their behavior");
  for (const [width, height] of [
    [834, 1194],
    [390, 844],
  ]) {
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await until("!document.querySelector('.desktop-follow-cards')");
  }
  assert.deepEqual(errors, [], "No dashboard runtime errors");
  console.log(
    "All follow-up native touch checks passed; desktop and portrait/phone branches stay unchanged",
  );
} finally {
  websocket?.close();
  chrome.kill("SIGTERM");
  await new Promise((resolve) => server.close(resolve));
  rmSync(temporary, { recursive: true, force: true });
}
