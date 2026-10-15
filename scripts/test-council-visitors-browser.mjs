import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  globSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { build } from "esbuild";

// Run the actual shared template in CI's preinstalled Chrome, with no family data.
const prepareOnly = process.argv.includes("--prepare-only");
const chromePath =
  process.env.CHROME_PATH ||
  ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find(existsSync);
if (!chromePath && !prepareOnly) throw Error("Preinstalled Chrome is required for visitor checks");
const temporary = mkdtempSync(join(tmpdir(), "alsaif-visitor-qa-"));
const output = join(temporary, "assets");
const compiled = [...globSync(".output/public/**/styles-*.css")];
assert.ok(compiled.length, "Build the application before its component checks");
const root = readFileSync("src/routes/__root.tsx", "utf8");
const imports = new Map(
  [...root.matchAll(/import (\w+) from "\.\.\/([^"?]+\.css)\?url";/g)].map((m) => [
    m[1],
    `src/${m[2]}`,
  ]),
);
const ordered = [...root.matchAll(/href:(\w+Css)/g)].map((m) => imports.get(m[1])).filter(Boolean);
const css = [
  readFileSync(compiled[0], "utf8"),
  ...ordered.filter((p) => p !== "src/styles.css").map((p) => readFileSync(p, "utf8")),
].join("\n");
const entry = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {HeritagePortal3D} from './src/components/dashboard/heritage-portal-3d';
import {PrayerMushafShortcuts} from './src/components/dashboard/prayer-mushaf-shortcuts';
import {useRecordedVisitorCount,useOnlineCount} from './src/lib/presence';
window.qaHold=location.pathname==='/loading';window.qaFail=location.pathname==='/error';window.qaWaiters=[];
window.qaRows=[{user_id:'one',last_seen_at:new Date().toISOString()},{user_id:'two',last_seen_at:'2026-01-01T00:00:00Z'}];
window.qaTotal=1248;window.qaQueries=0;
window.qaRelease=()=>{window.qaHold=false;window.qaWaiters.splice(0).forEach(resolve=>resolve())};
window.qaVisit=(id)=>{const found=window.qaRows.some(row=>row.user_id===id);if(!found){window.qaRows.push({user_id:id,last_seen_at:new Date().toISOString()});window.qaTotal++}window.qaChange({eventType:found?'UPDATE':'INSERT',new:{user_id:id,last_seen_at:new Date().toISOString()}})};
function Fixture(){const count=useRecordedVisitorCount();const online=useOnlineCount();const [name,setName]=useState('حساب المعاينة');const [show,setShow]=useState(true);window.qaSetName=setName;window.qaSetShow=setShow;
const hero=<HeritagePortal3D greeting="مساء الخير" name={name} message="نصل العائلة، نحفظ الإرث، ونبني المستقبل." className="dashboard-portal-model" visitorCount={show?count:undefined}/>;
const services=<div className="desktop-services-panel"><div className="desktop-section-head desktop-section-head-on-dark"><h2>خدمات العائلة</h2></div><div className="desktop-services-grid">{['الصندوق المالي','المهام','الرحلات','الاجتماعات'].map(label=><div className="desktop-service-card" key={label}><strong>{label}</strong></div>)}</div><button className="desktop-services-wide-toggle">عرض جميع الخدمات</button></div>;
return <main className="app-shell-main relative min-h-screen"><div className="app-shell-content p-4 md:p-8 lg:p-12 pt-24 md:pt-6 mx-auto max-w-7xl"><output hidden id="qa-online">{online}</output>{innerWidth>=1200?<div className="desktop-rebuild-shell"><div className="desktop-rebuild-root"><section className="desktop-overview-shell"><div className="desktop-portal-stage">{hero}</div>{services}</section></div></div>:<div className="dashboard-page max-w-6xl mx-auto space-y-12"><section className="dashboard-portal-hero has-faith-shortcuts"><div className="dashboard-portal-card"><PrayerMushafShortcuts/><div className="dashboard-portal-layout">{hero}</div></div></section></div>}</div></main>}
createRoot(document.getElementById('app')).render(<Fixture/>);window.fixtureReady=true;`;
await build({
  stdin: {
    contents: entry,
    resolveDir: process.cwd(),
    sourcefile: "visitor-qa.tsx",
    loader: "tsx",
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  outdir: output,
  entryNames: "fixture",
  assetNames: "[name]-[hash]",
  publicPath: "/__qa/",
  loader: { ".webp": "file" },
  tsconfig: "tsconfig.json",
  plugins: [
    {
      name: "isolated-visitor-records",
      setup(builder) {
        builder.onResolve({ filter: /^@\/integrations\/supabase\/client$/ }, () => ({
          path: "supabase",
          namespace: "qa",
        }));
        builder.onResolve({ filter: /^@\/hooks\/use-prayer-times$/ }, () => ({
          path: "prayer",
          namespace: "qa",
        }));
        builder.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({
          path: "router",
          namespace: "qa",
        }));
        builder.onLoad({ filter: /.*/, namespace: "qa" }, ({ path }) => ({
          loader: "jsx",
          resolveDir: process.cwd(),
          contents:
            path === "supabase"
              ? `export const supabase={from:()=>({select:async(fields,options)=>{if(options?.count!=='exact')throw Error('Exact server count required');window.qaQueries++;if(window.qaHold)await new Promise(resolve=>window.qaWaiters.push(resolve));return window.qaFail?{data:null,count:null,error:{message:'unavailable'}}:{data:window.qaRows.map(row=>({...row})),count:window.qaTotal}}}),channel:()=>{const channel={on:(event,filter,callback)=>{window.qaChange=callback;return channel},subscribe:callback=>{window.qaSubscription=callback;setTimeout(()=>callback?.('SUBSCRIBED'),0);return channel}};return channel}};`
              : path === "prayer"
                ? `export const usePrayerTimes=()=>({location:{latitude:27,longitude:49},locationLabel:'حسب موقعك',prayer:{name:'الفجر'},countdown:'باقي ٨ ساعات',loading:false});`
                : `import React from 'react';export const useNavigate=()=>()=>{};export function Link({to,search,children,...props}){return <a {...props} href={to}>{children}</a>}`,
        }));
      },
    },
  ],
});
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\nhtml,body{margin:0}body{background:var(--background);color:var(--foreground)}main{min-width:0}</style><link rel="stylesheet" href="/__qa/fixture.css"></head><body><div id="app"></div><script src="/__qa/fixture.js"></script></body></html>`;
if (prepareOnly) {
  rmSync(temporary, { recursive: true, force: true });
  console.log("Actual visitor counter / presence / hero fixture compiled");
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
      path.endsWith(".js")
        ? "application/javascript"
        : path.endsWith(".css")
          ? "text/css"
          : "image/webp",
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
  const settle = () =>
    evaluate(
      "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,80))))",
    );
  const until = async (expression) => {
    for (let i = 0; i < 120; i++) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw Error(`Timed out: ${expression}`);
  };
  await send("Page.enable");
  await send("Runtime.enable");
  mkdirSync("test-results/visitors", { recursive: true });
  const navigate = async (path = "/") => {
    await send("Page.navigate", { url: `http://127.0.0.1:${port}${path}` });
    await until(
      "window.fixtureReady && document.querySelector('.council-visitor-number') && Array.from(document.images).every(i=>i.complete)",
    );
    await settle();
  };
  const counterText = () =>
    evaluate("document.querySelector('.council-visitor-number').textContent.trim()");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate("/loading");
  assert.equal(await counterText(), "—", "No fabricated zero while loading");
  await evaluate("window.qaRelease()");
  await until("document.querySelector('.council-visitor-number').textContent==='1,248'");
  assert.equal(
    await evaluate("document.getElementById('qa-online').textContent"),
    "1",
    "Fixture has just one online account",
  );
  assert.equal(
    await counterText(),
    "1,248",
    "All saved visitors, not online count or paginated row count",
  );
  await evaluate("window.qaVisit('one');window.qaVisit('one')");
  await settle();
  assert.equal(
    await counterText(),
    "1,248",
    "Same account returning from multiple devices is not another visitor",
  );
  await evaluate("window.qaVisit('three')");
  await until("document.querySelector('.council-visitor-number').textContent==='1,249'");
  await evaluate('window.qaTotal=1252;window.qaSubscription("SUBSCRIBED")');
  await until("document.querySelector('.council-visitor-number').textContent==='1,252'");
  await evaluate('window.qaFail=true;window.qaSubscription("SUBSCRIBED")');
  await settle();
  assert.equal(await counterText(), "1,252", "Transient failure retains the last valid count");
  await navigate("/error");
  assert.equal(await counterText(), "—", "Failed first request does not invent zero");
  console.log(
    "PASS saved unique visitors, first-visit realtime update, reconnect, pagination and failed reads",
  );
  for (const [name, width, height] of [
    ["phone-small", 320, 800],
    ["phone", 390, 844],
    ["ipad-portrait", 834, 1194],
    ["ipad-landscape", 1024, 768],
    ["desktop", 1440, 1000],
  ]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await navigate();
    await until("document.querySelector('.council-visitor-number').textContent==='1,248'");
    await evaluate(
      `document.documentElement.dataset.dashboardTabletLandscape=${JSON.stringify(width >= 970 && width < 1200 ? "true" : "false")}`,
    );
    await settle();
    await evaluate(
      `window.qaVisibleTower=async()=>{const node=document.querySelector('.council-portal-towers image');const r=node.getBoundingClientRect();return {left:r.left+r.width*70/1065,right:r.left+r.width*996/1065,top:r.top+r.height*137/1477,bottom:r.top+r.height*1227/1477,width:r.width,height:r.height}}`,
    );
    const modelBefore = await evaluate("window.qaVisibleTower()");
    await evaluate("window.qaSetShow(false)");
    await settle();
    const modelBaseline = await evaluate("window.qaVisibleTower()");
    assert.ok(
      Math.abs(modelBefore.width - modelBaseline.width) < 1,
      `${name}: existing sculpture width retained`,
    );
    assert.ok(
      Math.abs(modelBefore.height - modelBaseline.height) < 1,
      `${name}: existing sculpture height retained`,
    );
    await evaluate("window.qaSetShow(true)");
    await settle();
    for (const longName of [false, true]) {
      await evaluate(
        `window.qaSetName(${JSON.stringify(longName ? "محمد بن عبدالرحمن بن عبدالعزيز بن عبدالله السيف" : "حساب المعاينة")})`,
      );
      await settle();
      const geometry = await evaluate(
        `(async()=>{const r=document.querySelector('.council-visitor-counter').getBoundingClientRect(),m=document.querySelector('.council-portal-message').getBoundingClientRect(),s=document.querySelector('.council-terrain-scene').getBoundingClientRect(),t=await window.qaVisibleTower();return {gap:innerWidth<970?t.top-r.bottom:t.left-r.right,mottoGap:r.top-m.bottom,contained:r.left>=s.left&&r.right<=s.right&&r.bottom<=s.bottom,overflow:document.documentElement.scrollWidth>innerWidth+2,label:document.querySelector('.council-terrain-scene').getAttribute('aria-label'),scene:{left:s.left,right:s.right,width:s.width},tower:t,parts:Array.from(document.querySelector('.council-visitor-text').children).map(n=>{const p=n.getBoundingClientRect();return{left:p.left,right:p.right,text:n.textContent}})}})()`,
      );
      console.log(name, JSON.stringify(geometry));
      assert.ok(
        geometry.gap >= 32,
        `${name}/${longName ? "long" : "normal"}: clear distance from visible sculpture ${JSON.stringify(geometry)}`,
      );
      assert.ok(geometry.mottoGap >= 16, `${name}: welcome spacing`);
      assert.ok(
        geometry.tower.right <= geometry.scene.right + 1 &&
          geometry.tower.left >= geometry.scene.left - 1,
        `${name}: sculpture remains inside its scene`,
      );
      assert.ok(
        geometry.parts[0].left >= geometry.parts[1].right - 1 &&
          geometry.parts[1].left >= geometry.parts[2].right - 1,
        `${name}: words and number do not overlap`,
      );
      assert.ok(geometry.contained, `${name}: count stays inside hero`);
      assert.equal(geometry.overflow, false, `${name}: no horizontal overflow`);
      assert.ok(
        geometry.label.includes("1,248"),
        `${name}: count is available to assistive technology`,
      );
    }
    await evaluate(
      "window.qaSetName('حساب المعاينة');document.documentElement.classList.add('dark')",
    );
    await settle();
    assert.equal(await counterText(), "1,248");
    await evaluate("document.documentElement.classList.remove('dark')");
    await settle();
    const identity = await evaluate(
      `(async()=>{const scene=document.querySelector('.council-terrain-scene');scene.style.setProperty('--identity-accent','#b97946');scene.style.setProperty('--council-portal-copy','#fff3dc');await new Promise(resolve=>setTimeout(resolve,450));return {number:getComputedStyle(scene.querySelector('.council-visitor-number')).color,text:getComputedStyle(scene.querySelector('.council-visitor-counter')).color}})()`,
    );
    assert.equal(identity.number, "rgb(185, 121, 70)");
    assert.equal(identity.text, "rgb(255, 243, 220)");
    const layout = await send("Page.getLayoutMetrics");
    const png = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: Math.ceil(layout.cssContentSize.height), scale: 1 },
    });
    writeFileSync(`test-results/visitors/${name}.png`, Buffer.from(png.data, "base64"));
    console.log(
      `PASS ${name}: identity, long-name spacing, unchanged sculpture size, accessibility and dark/light`,
    );
  }
  assert.deepEqual(errors, [], "No visitor/presence/React runtime exceptions");
  console.log("All actual visitor-counter Chrome checks passed");
} finally {
  websocket?.close();
  chrome.kill("SIGTERM");
  await new Promise((resolve) => server.close(resolve));
  rmSync(temporary, { recursive: true, force: true });
}
