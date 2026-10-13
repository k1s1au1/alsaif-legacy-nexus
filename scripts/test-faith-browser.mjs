import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, globSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { build } from "esbuild";

// Test the actual React components in GitHub's preinstalled Chrome. Profile and
// HTTP fixtures isolate these checks from family accounts and external uptime;
// the official scan content is audited separately, without any transcription.
const chromePath = process.env.CHROME_PATH || ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
const prepareOnly = process.argv.includes("--prepare-only");
if (!chromePath && !prepareOnly) throw Error("Preinstalled Chrome is required for faith component checks");
const temporary = mkdtempSync(join(tmpdir(), "alsaif-faith-qa-"));
const output = join(temporary, "assets");
const rootSource = readFileSync("src/routes/__root.tsx", "utf8");
const imports = new Map([...rootSource.matchAll(/import (\w+) from "\.\.\/([^"?]+\.css)\?url";/g)].map(m => [m[1], `src/${m[2]}`]));
const ordered = [...rootSource.matchAll(/href:(\w+Css)/g)].map(m => imports.get(m[1])).filter(Boolean);
const compiled = [...globSync(".output/public/**/styles-*.css")];
assert.ok(compiled.length, "Build the application before its component browser checks");
const css = [readFileSync(compiled[0], "utf8"), ...ordered.filter(path => path !== "src/styles.css").map(path => readFileSync(path, "utf8"))].join("\n");
const entry = `import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {FaithCenter} from './src/components/faith/faith-center';
import {PrayerMushafShortcuts} from './src/components/dashboard/prayer-mushaf-shortcuts';
import {HeritagePortal3D} from './src/components/dashboard/heritage-portal-3d';
const NativeDate=Date, fixed=NativeDate.parse('2026-10-13T21:00:00+03:00');
window.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[fixed]))}static now(){return fixed}};
const originalFetch=window.fetch.bind(window);window.prayerRequests=[];
window.fetch=async (input, options)=>{const url=String(input);if(!url.startsWith('https://api.aladhan.com/'))return originalFetch(input,options);
window.prayerRequests.push(url);const parts=new URL(url).pathname.split('/');const year=Number(parts.at(-2)),month=Number(parts.at(-1));
return new Response(JSON.stringify({code:200,data:Array.from({length:new NativeDate(NativeDate.UTC(year,month,0)).getUTCDate()},(_,i)=>{
const date=year+'-'+String(month).padStart(2,'0')+'-'+String(i+1).padStart(2,'0');return{date:{gregorian:{date:String(i+1).padStart(2,'0')+'-'+String(month).padStart(2,'0')+'-'+year}},meta:{method:{id:4},timezone:'Asia/Riyadh'},timings:Object.fromEntries([['Fajr','05:00'],['Dhuhr','12:00'],['Asr','15:15'],['Maghrib','18:00'],['Isha','19:30']].map(([k,t])=>[k,date+'T'+t+':00+03:00']))}})}),{headers:{'Content-Type':'application/json'}})};
function Fixture(){const [view,setView]=useState(new URLSearchParams(location.search).get('view')==='prayer'?'prayer':'mushaf');
if(location.pathname==='/home')return <main className="app-shell-main"><div className="app-shell-content"><div className="dashboard-page max-w-6xl mx-auto space-y-12"><section className="dashboard-spiritual dashboard-faith-strip"><div className="dashboard-faith-label">نفحات إيمانية</div></section><section className="dashboard-hero dashboard-portal-hero has-faith-shortcuts"><div className="dashboard-portal-card"><PrayerMushafShortcuts/><div className="dashboard-portal-layout"><HeritagePortal3D greeting="مساء الخير" name="حساب المراجعة فقط" message="نصل العائلة، نحفظ الإرث، ونبني المستقبل." className="dashboard-portal-model"/></div></div></section></div></div></main>;
return <main style={{padding:16}}><FaithCenter view={view} onViewChange={setView}/></main>}
createRoot(document.getElementById('app')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Fixture/></QueryClientProvider>);window.fixtureReady=true;`;

await build({ stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: "faith-qa.tsx", loader: "tsx" }, bundle: true, format: "iife", platform: "browser", outdir: output, entryNames: "fixture", assetNames: "[name]-[hash]", publicPath: "/__qa/", loader: { ".webp": "file", ".png": "file" }, tsconfig: "tsconfig.json", plugins: [{ name: "isolated-family-profile", setup(builder) {
  builder.onResolve({ filter: /^@\/hooks\/use-dashboard-data$/ }, () => ({ path: "profile", namespace: "qa" }));
  builder.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({ path: "router", namespace: "qa" }));
  builder.onLoad({ filter: /.*/, namespace: "qa" }, ({ path }) => path === "profile" ? { contents: `export const useProfile=()=>({data:{id:'qa-member'}});`, loader: "js" } : { contents: `import React from 'react';export function Link({to,search,children,...props}){return <a {...props} href={to+(search?'?'+new URLSearchParams(search):'')}>{children}</a>}`, loader: "jsx", resolveDir: process.cwd() });
} }] });
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\nhtml,body{margin:0}body{background:var(--background);color:var(--foreground)}.app-shell-content{padding:16px}main{min-width:0}</style><link rel="stylesheet" href="/__qa/fixture.css"></head><body><div id="app"></div><script src="/__qa/fixture.js"></script></body></html>`;
if (prepareOnly) { rmSync(temporary, { recursive: true, force: true }); console.log("Actual faith React/CSS browser fixture compiled successfully"); process.exit(0); }
const server = createServer((request, response) => {
  if (request.url.startsWith("/__qa/")) {
    const path = join(output, request.url.slice(6));
    if (!path.startsWith(output) || !existsSync(path)) { response.writeHead(404); response.end(); return; }
    response.setHeader("Content-Type", path.endsWith(".js") ? "application/javascript" : path.endsWith(".css") ? "text/css" : "image/webp");
    response.end(readFileSync(path)); return;
  }
  response.setHeader("Content-Type", "text/html;charset=utf-8"); response.end(html);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const chrome = spawn(chromePath, ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${join(temporary, 'profile')}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
let websocket;
try {
  const debuggerURL = await new Promise((resolve, reject) => { let buffer = ""; const timeout = setTimeout(() => reject(Error("Chrome start timeout")), 20000); chrome.stderr.on("data", data => { buffer += data; const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buffer); if (match) { clearTimeout(timeout); resolve(match[1]); } }); chrome.on("exit", code => { clearTimeout(timeout); reject(Error(`Chrome exited ${code}`)); }); });
  const debug = new URL(debuggerURL);
  const targets = await (await fetch(`http://${debug.host}/json/list`)).json();
  websocket = new WebSocket(targets.find(target => target.type === "page").webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const pageErrors = [];
  let rejectScan = false;
  const send = (method, params = {}) => new Promise((resolve, reject) => { const number = ++id; pending.set(number, { resolve, reject }); websocket.send(JSON.stringify({ id: number, method, params })); });
  websocket.addEventListener("message", async event => { const message = JSON.parse(event.data);
    if (message.id) { const request = pending.get(message.id); if (request) { pending.delete(message.id); message.error ? request.reject(Error(JSON.stringify(message.error))) : request.resolve(message.result); } }
    if (message.method === "Runtime.exceptionThrown") pageErrors.push(message.params.exceptionDetails.text);
    if (message.method === "Fetch.requestPaused") {
      if (rejectScan) await send("Fetch.failRequest", { requestId: message.params.requestId, errorReason: "InternetDisconnected" });
      else await send("Fetch.fulfillRequest", { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "image/svg+xml" }], body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="622" height="916"><rect width="622" height="916" fill="white"/></svg>').toString("base64") });
    }
  });
  await new Promise((resolve, reject) => { websocket.addEventListener("open", resolve, { once: true }); websocket.addEventListener("error", reject, { once: true }); });
  const evaluate = async expression => { const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const until = async expression => { for (let i = 0; i < 160; i++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise(resolve => setTimeout(resolve, 40)); } throw Error(`Timed out: ${expression}`); };
  const settle = () => evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,120))))");
  const navigate = async path => { await send("Page.navigate", { url: `http://127.0.0.1:${port}${path}` }); await until("window.fixtureReady && document.querySelector('.faith-page,.faith-home-shortcuts')"); await settle(); };
  const viewport = async (width, height) => { await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }); await settle(); };
  const screenshot = async name => { const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); writeFileSync(`test-results/faith/${name}.png`, Buffer.from(result.data, "base64")); };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "https://quran.ksu.edu.sa/safahat/png_big/*.png" }] });
  mkdirSync("test-results/faith", { recursive: true });

  for (const [name, width, height] of [["phone", 425, 900], ["small-phone", 360, 800], ["ipad-portrait", 834, 1194], ["ipad-landscape", 1024, 768], ["desktop", 1440, 900]]) {
    await viewport(width, height); await navigate("/faith?view=mushaf");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), true, `${name}: landing page must fit`);
    assert.equal(await evaluate("document.querySelectorAll('.faith-surah-list button').length"), 114);
    await evaluate("document.querySelector('.faith-search input').value=''; document.querySelector('.faith-surah-list button').click()");
    await until("document.querySelector('.mushaf-page-image img') && Array.from(document.querySelectorAll('.mushaf-page-image img')).every(i=>i.complete && i.naturalWidth>0)"); await settle();
    assert.equal(await evaluate("document.querySelectorAll('.mushaf-page-image').length"), width >= 1024 ? 2 : 1, `${name}: page/spread behavior`);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), true, `${name}: reader must fit`);
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.mushaf-page-image img')).every(i=>i.src.startsWith('https://quran.ksu.edu.sa/safahat/png_big/'))"), true);
    await until("JSON.parse(localStorage.getItem('alsaif:mushaf:last-page:v1:qa-member')||'null')?.page===1");
    await screenshot(name);
    await evaluate("document.querySelector('button[aria-label=\"الرجوع إلى فهرس مصحفي\"]').click()"); await settle();
    assert.ok((await evaluate("document.querySelector('.faith-resume-copy').textContent")).includes("أكمل قراءتك"));
    console.log(`PASS ${name}: index, reading, verified source URL, bookmark and responsive width`);
  }
  await viewport(425, 900); await navigate("/faith?view=prayer");
  await evaluate("const s=document.querySelector('.faith-city-selector select');s.value='riyadh';s.dispatchEvent(new Event('change',{bubbles:true}))");
  await until("document.querySelectorAll('.faith-prayer-time').length===5");
  assert.ok((await evaluate("document.querySelector('.faith-summary-next').textContent")).includes("الفجر"));
  assert.equal(await evaluate("new URL(window.prayerRequests.at(-1)).searchParams.get('method')"), "4");
  await screenshot("prayer-phone");
  console.log("PASS selected city, five verified-method times and next-day Fajr after Isha");

  await evaluate("localStorage.removeItem('alsaif:mushaf:last-page:v1:qa-member')");
  rejectScan = true; await navigate("/faith?view=mushaf");
  await evaluate("document.querySelector('.faith-resume-copy button').click()");
  await until("document.querySelector('.mushaf-page-error')");
  assert.equal(await evaluate("localStorage.getItem('alsaif:mushaf:last-page:v1:qa-member')"), null);
  assert.equal(await evaluate("document.querySelector('.mushaf-page-error a').href"), "https://quran.ksu.edu.sa/safahat/png_big/1.png");
  rejectScan = false;
  await evaluate("document.querySelector('.mushaf-page-error button').click()");
  await until("JSON.parse(localStorage.getItem('alsaif:mushaf:last-page:v1:qa-member')||'null')?.page===1");
  console.log("PASS failed scan cannot save an unread page or introduce a nonofficial fallback; retry succeeds");

  for (const [name, width, height] of [["home-phone", 425, 900], ["home-small-phone", 360, 800], ["home-ipad-portrait", 834, 1194], ["home-ipad-landscape", 1024, 768]]) {
    await viewport(width, height); await navigate("/home");
    const layout = await evaluate(`(()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return{top:b.top,bottom:b.bottom,left:b.left,width:b.width,height:b.height}};return{shortcut:r('.faith-home-shortcuts'),copy:r('.council-portal-copy'),quote:r('.dashboard-spiritual'),model:r('.council-portal-model')}})()`);
    assert.ok(layout.shortcut.top >= layout.quote.bottom - 1, `${name}: below Nafahat`);
    if (width < 970) assert.ok(layout.shortcut.bottom <= layout.copy.top + 1, `${name}: shortcuts before welcome, without overlap`);
    const baseline = await evaluate(`(()=>{const section=document.querySelector('.has-faith-shortcuts');section.classList.remove('has-faith-shortcuts');document.querySelector('.faith-home-shortcuts').style.display='none';const r=document.querySelector('.council-portal-model').getBoundingClientRect();const result={top:r.top,left:r.left,width:r.width,height:r.height};section.classList.add('has-faith-shortcuts');document.querySelector('.faith-home-shortcuts').style.display='';return result})()`);
    for (const key of ["top", "left", "width", "height"]) assert.ok(Math.abs(baseline[key] - layout.model[key]) < 1, `${name}: unchanged approved gateway ${key}`);
    await screenshot(name); console.log(`PASS ${name}: selected placement and unchanged gateway geometry`);
  }
  assert.deepEqual(pageErrors, [], "No React/runtime exceptions in actual component fixtures");
  console.log("All faith Chrome component checks passed. Scan images were stubbed; source content has an independent official audit.");
} finally {
  websocket?.close(); chrome.kill("SIGTERM"); await new Promise(resolve => server.close(resolve));
  rmSync(temporary, { recursive: true, force: true });
}
