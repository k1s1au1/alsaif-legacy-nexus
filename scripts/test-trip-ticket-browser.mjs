import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, globSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { build } from "esbuild";

// Run the actual shared template in CI's preinstalled Chrome, with no family data.
const prepareOnly = process.argv.includes("--prepare-only");
const chromePath = process.env.CHROME_PATH || ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find(existsSync);
if (!chromePath && !prepareOnly) throw Error("Preinstalled Chrome is required for ticket checks");
const temporary = mkdtempSync(join(tmpdir(), "alsaif-ticket-qa-"));
const output = join(temporary, "assets");
const compiled = [...globSync(".output/public/**/styles-*.css")];
assert.ok(compiled.length, "Build the application before its component checks");
const root = readFileSync("src/routes/__root.tsx", "utf8");
const imports = new Map([...root.matchAll(/import (\w+) from "\.\.\/([^"?]+\.css)\?url";/g)].map(m => [m[1], `src/${m[2]}`]));
const ordered = [...root.matchAll(/href:(\w+Css)/g)].map(m => imports.get(m[1])).filter(Boolean);
const css = [readFileSync(compiled[0], "utf8"), ...ordered.filter(p => p !== "src/styles.css").map(p => readFileSync(p, "utf8"))].join("\n");
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import {Pencil,Trash2,ChevronLeft} from 'lucide-react';
import {TripTicket} from './src/components/trip-ticket';
import {UpcomingTripTicket} from './src/components/upcoming-trip-ticket';
import photo from './src/assets/trip-alula.jpg';
window.edits=0;window.deletes=0;
const trip={title:'رحلة العلا',status:'upcoming',location:'العلا',badge:null,description:'استكشاف المعالم الطبيعية والتراثية مع العائلة.',start_date:'2026-10-21',end_date:'2026-10-23'};
const image=<img src={photo} alt="العلا"/>;
const details=<a href="#details">عرض التفاصيل <ChevronLeft size={18}/></a>;
const actions=<><button type="button" onClick={()=>window.edits++}><Pencil size={18}/>تعديل</button><button type="button" className="trip-ticket__delete" onClick={()=>window.deletes++}><Trash2 size={18}/>حذف</button></>;
function Fixture(){return <main><h1>قالب التذاكر الموحّد</h1><p>معاينة المكونات الفعلية ببيانات تجريبية</p>
<section className="qa-home dashboard-page integrated-hub"><h2>الرئيسية</h2><UpcomingTripTicket trip={trip} image={image} details={details} compact/></section>
<section className="trips-page"><h2>قائمة الرحلات</h2><div className="trips-ticket-grid trips-ticket-grid--upcoming"><TripTicket trip={trip} image={image} details={details} statusControl={<span>قادمة</span>} actions={actions}/><TripTicket trip={{...trip,title:'عرض العضو',description:null}} image={image} details={details} statusControl={<span>قادمة</span>}/></div>
<h2>قيد التخطيط — القالب الحالي</h2><TripTicket trip={{...trip,status:'planning'}} image={image} details={<a className="trip-ticket__details" href="#planning">شارك في التخطيط</a>} statusControl={<span>قيد التخطيط</span>} actions={actions}/></section></main>}
createRoot(document.getElementById('app')).render(<Fixture/>);window.fixtureReady=true;`;
await build({ stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: "ticket-qa.tsx", loader: "tsx" }, bundle: true, format: "iife", platform: "browser", outdir: output, entryNames: "fixture", assetNames: "[name]-[hash]", publicPath: "/__qa/", loader: { ".jpg": "file" }, tsconfig: "tsconfig.json" });
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
html,body{margin:0}body{background:var(--background);color:var(--foreground)}main{max-width:1240px;margin:auto;padding:24px;min-width:0}main>h1{font-size:30px;font-weight:900}main>p{margin:8px 0 24px}h2{margin:20px 0 16px;font-size:22px;font-weight:800}.qa-home{max-width:900px;margin:0 auto 28px;padding:20px;border-radius:24px;background:repeating-linear-gradient(45deg,var(--background) 0 12px,var(--muted) 12px 24px)}.trips-page{padding:0 0 24px}.qa-home .upcoming-trip-ticket{width:100%}</style><link rel="stylesheet" href="/__qa/fixture.css"></head><body><div id="app"></div><script src="/__qa/fixture.js"></script></body></html>`;
if (prepareOnly) { rmSync(temporary, { recursive: true, force: true }); console.log("Actual ticket React/CSS fixture compiled successfully"); process.exit(0); }
const server = createServer((request, response) => {
  if (request.url.startsWith("/__qa/")) {
    const path = join(output, request.url.slice(6));
    if (!path.startsWith(output) || !existsSync(path)) { response.writeHead(404); response.end(); return; }
    response.setHeader("Content-Type", path.endsWith(".js") ? "application/javascript" : path.endsWith(".css") ? "text/css" : "image/jpeg");
    response.end(readFileSync(path)); return;
  }
  response.setHeader("Content-Type", "text/html;charset=utf-8");response.end(html);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const chrome = spawn(chromePath, ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${join(temporary, "profile")}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
let websocket;
try {
  const debuggerURL = await new Promise((resolve, reject) => {
    let buffer = "";const timeout = setTimeout(() => reject(Error("Chrome start timeout")), 20000);
    chrome.stderr.on("data", data => { buffer += data;const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buffer);if (match) { clearTimeout(timeout);resolve(match[1]); } });
    chrome.on("exit", code => { clearTimeout(timeout);reject(Error(`Chrome exited ${code}`)); });
  });
  const debug = new URL(debuggerURL);
  const targets = await (await fetch(`http://${debug.host}/json/list`)).json();
  websocket = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
  let id = 0;const pending = new Map();const errors = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => { const number = ++id;pending.set(number, { resolve, reject });websocket.send(JSON.stringify({ id: number, method, params })); });
  websocket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id) { const request = pending.get(message.id);if (request) { pending.delete(message.id);message.error ? request.reject(Error(JSON.stringify(message.error))) : request.resolve(message.result); } }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  });
  await new Promise(resolve => websocket.addEventListener("open", resolve, { once: true }));
  const evaluate = async expression => { const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));return result.result.value; };
  const settle = () => evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,80))))");
  const until = async expression => { for (let i = 0; i < 120; i++) { if (await evaluate(`Boolean(${expression})`)) return;await new Promise(resolve => setTimeout(resolve,40)); }throw Error(`Timed out: ${expression}`); };
  await send("Page.enable");await send("Runtime.enable");
  mkdirSync("test-results/trip-tickets", { recursive: true });
  for (const [name, width, height] of [["phone",360,900],["ipad-portrait",834,1194],["ipad-landscape",1024,768],["desktop",1440,1000]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: `http://127.0.0.1:${port}/` });
    await until("window.fixtureReady && document.querySelectorAll('.ticket-surface__outline').length===3 && Array.from(document.images).every(i=>i.complete && i.naturalWidth>0)");await settle();
    for (const dark of [false,true]) {
      await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);await settle();
      const cuts = await evaluate(`Array.from(document.querySelectorAll('.ticket-surface')).map(ticket=>{
        const paper=ticket.querySelector('.ticket-surface__paper'),head=ticket.querySelector('.ticket-surface__header');
        const r=paper.getBoundingClientRect(),seam=r.top+head.offsetHeight;
        const inside=(x,y)=>!!document.elementFromPoint(x,y)?.closest('.ticket-surface__paper');
        ticket.scrollIntoView({block:'center'});const b=paper.getBoundingClientRect(),y=b.top+head.offsetHeight;
        return {validClip:CSS.supports('clip-path',paper.style.clipPath),transparent:getComputedStyle(ticket).backgroundColor==='rgba(0, 0, 0, 0)',leftCut:!inside(b.left+3,y),rightCut:!inside(b.right-3,y),inner:inside(b.left+24,y),radius:ticket.querySelector('path').getAttribute('d').includes('A 14 14'),paperWidth:paper.offsetWidth,outlineWidth:Number(ticket.querySelector('svg.ticket-surface__outline').getAttribute('width'))};
      })`);
      assert.equal(cuts.length,3);
      for (const cut of cuts) { for (const key of ['validClip','transparent','leftCut','rightCut','inner','radius']) assert.equal(cut[key],true,`${name}/${dark?'dark':'light'}: ${key}`);assert.equal(cut.paperWidth,cut.outlineWidth); }
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+2"),true,`${name}: no horizontal overflow`);
    }
    await evaluate("document.documentElement.classList.remove('dark');scrollTo(0,0)");await settle();
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.upcoming-trip-ticket__actions button')).every(b=>b.getBoundingClientRect().height>=44 && getComputedStyle(b).visibility==='visible')"),true,`${name}: touch actions visible`);
    await evaluate("document.querySelector('.upcoming-trip-ticket__actions button').click();document.querySelector('.upcoming-trip-ticket__actions .trip-ticket__delete').click()");
    assert.equal(await evaluate("window.edits===1 && window.deletes===1"),true,`${name}: original action callbacks work`);
    assert.equal(await evaluate("document.querySelectorAll('.upcoming-trip-ticket')[2].querySelector('.upcoming-trip-ticket__actions')"),null,`${name}: member has no management actions`);
    assert.equal(await evaluate("!!document.querySelector('.trip-ticket--planning .trip-ticket__fold') && !document.querySelector('.trip-ticket--planning .ticket-surface__outline')"),true,`${name}: planning keeps its separate template`);
    const layout = await send("Page.getLayoutMetrics");
    const png = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.ceil(layout.cssContentSize.height), scale: 1 } });
    writeFileSync(`test-results/trip-tickets/${name}.png`, Buffer.from(png.data,"base64"));
    console.log(`PASS ${name}: real transparent 14px cuts, aligned border, dark/light, touch actions, member visibility and planning exception`);
  }
  assert.deepEqual(errors,[],"No React or ResizeObserver runtime errors");
  console.log("All actual ticket Chrome component checks passed");
} finally {
  websocket?.close();chrome.kill("SIGTERM");await new Promise(resolve=>server.close(resolve));rmSync(temporary,{recursive:true,force:true});
}
