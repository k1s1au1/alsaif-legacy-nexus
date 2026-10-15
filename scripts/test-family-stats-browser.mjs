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
if (!chromePath && !prepareOnly) throw Error("Preinstalled Chrome is required for statistics checks");
const temporary = mkdtempSync(join(tmpdir(), "alsaif-stats-qa-"));
const output = join(temporary, "assets");
const compiled = [...globSync(".output/public/**/styles-*.css")];
assert.ok(compiled.length, "Build the application before its component checks");
const root = readFileSync("src/routes/__root.tsx", "utf8");
const imports = new Map([...root.matchAll(/import (\w+) from "\.\.\/([^"?]+\.css)\?url";/g)].map(m => [m[1], `src/${m[2]}`]));
const ordered = [...root.matchAll(/href:(\w+Css)/g)].map(m => imports.get(m[1])).filter(Boolean);
const css = [readFileSync(compiled[0], "utf8"), ...ordered.filter(p => p !== "src/styles.css").map(p => readFileSync(p, "utf8"))].join("\n");
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import {FamilyStatsStrip} from './src/components/dashboard/family-stats-strip';
const tablet=new URLSearchParams(location.search).has('tablet');document.documentElement.dataset.dashboardTabletLandscape=tablet?'true':'false';
function Fixture(){const [values,setValues]=React.useState({balance:125000,members:24,trips:3,tasks:5});window.qaValues=setValues;
return <><header className="qa-stats-heading"><h1>الشريط المتصل</h1><p>معاينة ببيانات تجريبية · إحصائيات للعرض فقط</p></header><button id="qa-before" className="qa-focus-sentinel">قبل الملخص</button><main className="app-shell-main"><div className="app-shell-content p-4 md:p-8 lg:p-12 mx-auto max-w-7xl"><div className="dashboard-page max-w-6xl mx-auto space-y-12">{Array.from({length:6},(_,i)=><div key={i} hidden/>)}<FamilyStatsStrip {...values}/></div>{innerWidth>=970&&<div className={tablet?'tablet-landscape-desktop-content':'desktop-rebuild-shell'}><div className="desktop-rebuild-root"><FamilyStatsStrip {...values} className="family-stats-strip--desktop"/></div></div>}</div></main><button id="qa-after" className="qa-focus-sentinel">بعد الملخص</button></>}
createRoot(document.getElementById('app')).render(<Fixture/>);window.fixtureReady=true;`;
await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'stats-qa.tsx',loader:'tsx'},bundle:true,format:'iife',platform:'browser',outdir:output,entryNames:'fixture',tsconfig:'tsconfig.json'});
const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
html,body{margin:0}body{background:var(--background);color:var(--foreground)}.qa-stats-heading{max-width:1240px;margin:24px auto 0;padding:16px 24px;background:var(--card);color:var(--primary);border-radius:16px}.qa-stats-heading h1{font-size:26px;font-weight:900;margin:0}.qa-stats-heading p{font-size:14px;margin:6px 0 0}.qa-focus-sentinel{position:fixed;left:0;top:0;width:1px;height:1px;padding:0;border:0;clip-path:inset(50%);overflow:hidden}</style><link rel="stylesheet" href="/__qa/fixture.css"></head><body><div id="app"></div><script src="/__qa/fixture.js"></script></body></html>`;
if (prepareOnly) { rmSync(temporary, { recursive: true, force: true }); console.log("Actual read-only statistics fixture compiled successfully"); process.exit(0); }
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
  mkdirSync('test-results/stats',{recursive:true});
  for(const [name,width,height,tablet] of [['small-phone',320,900,false],['phone',390,900,false],['ipad-portrait',834,1194,false],['ipad-landscape',1024,768,true],['ipad-pro-landscape',1366,1024,true],['desktop',1440,1000,false]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await send('Emulation.setTouchEmulationEnabled',{enabled:width<1400,maxTouchPoints:5});
    await send('Page.navigate',{url:`http://127.0.0.1:${port}/${tablet?'?tablet=1':''}`});
    await until("window.fixtureReady && document.querySelector('.family-stats-strip')");await settle();
    await evaluate("window.qaVisible=()=>Array.from(document.querySelectorAll('.family-stats-strip')).filter(n=>n.getClientRects().length>0);window.qaStrip=()=>window.qaVisible()[0]");
    const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`test-results/stats/stats-${name}.png`,Buffer.from(png.data,'base64'));
    assert.equal(await evaluate('window.qaVisible().length'),1,`${name}: exactly one statistics summary is visible`);
    assert.equal(await evaluate("window.qaStrip().classList.contains('family-stats-strip--desktop')"),width>=970,`${name}: the original responsive dashboard branch stays in use`);
    assert.equal(await evaluate("window.qaStrip().querySelectorAll('a,button,input,select,textarea,[role=button],[tabindex]').length"),0,`${name}: the summary has no navigation or focusable actions`);
    assert.equal(await evaluate("window.qaStrip().querySelectorAll('dt').length"),4,`${name}: all four real metrics are labelled`);
    assert.equal(await evaluate("window.qaStrip().querySelector('.family-stats-strip__fund bdi').textContent"),'125,000',`${name}: the supplied balance is shown without changing the value`);
    const layout=await evaluate(`(()=>{const s=window.qaStrip(),box=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};return{root:box(s),fund:box(s.querySelector('.family-stats-strip__fund')),metrics:box(s.querySelector('.family-stats-strip__metrics')),cells:Array.from(s.querySelectorAll('.family-stats-strip__metric')).map(box)}})()`);
    if(Math.abs(layout.fund.y-layout.metrics.y)<=1){assert.ok(layout.fund.x>layout.metrics.x,`${name}: balance stays on the right of the connected strip`);assert.ok(Math.abs(layout.fund.bottom-layout.metrics.bottom)<=1,`${name}: the connected fields share one baseline`)}else{assert.ok(layout.fund.bottom+10<=layout.metrics.y,`${name}: small screens place the balance above the three metrics`)}
    assert.ok(layout.cells.every(c=>Math.abs(c.y-layout.cells[0].y)<1),`${name}: the three secondary metrics remain one row`);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),true,`${name}: no horizontal page overflow`);
    const before=await evaluate("({url:location.href,transform:getComputedStyle(window.qaStrip()).transform,background:getComputedStyle(window.qaStrip().querySelector('.family-stats-strip__fund')).backgroundColor})");
    await evaluate("window.qaStrip().querySelector('.family-stats-strip__metric').click();window.qaStrip().scrollIntoView({block:'center'})");
    const target=await evaluate("(()=>{const r=window.qaStrip().querySelector('.family-stats-strip__metric').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x,y:target.y});await settle();
    assert.equal(await evaluate('location.href'),before.url,`${name}: clicking a metric never navigates`);
    assert.equal(await evaluate('getComputedStyle(window.qaStrip()).transform'),before.transform,`${name}: no hover movement suggests a button`);
    assert.equal(await evaluate("getComputedStyle(window.qaStrip().querySelector('.family-stats-strip__fund')).backgroundColor"),before.background,`${name}: no hover repaint suggests a button`);
    assert.equal(await evaluate("getComputedStyle(window.qaStrip().querySelector('.family-stats-strip__metric')).cursor"),'default',`${name}: the metric keeps an informational cursor`);
    await evaluate("document.querySelector('#qa-before').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
    assert.equal(await evaluate('document.activeElement.id'),'qa-after',`${name}: keyboard navigation skips the read-only statistics`);
    for(const values of [{balance:1096099.75,members:12480,trips:9999,tasks:1280},{balance:-1234567890.25,members:0,trips:0,tasks:0}]){
      await evaluate(`window.qaValues(${JSON.stringify(values)})`);await settle();
      assert.equal(await evaluate("window.qaStrip().querySelector('.family-stats-strip__fund bdi').textContent"),new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(values.balance),`${name}: updated balances retain fractions and sign`);
      const clipping=await evaluate(`Array.from(window.qaStrip().querySelectorAll('bdi,dt span')).map(n=>{const r=n.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(n);const text=range.getBoundingClientRect();return{text:n.textContent,clipped:text.left<r.left-1||text.right>r.right+1}}).filter(n=>n.clipped)`);
      assert.deepEqual(clipping,[],`${name}: large balances and counts stay fully readable`);
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),true,`${name}: updated amounts never widen the page`);
    }
    await evaluate("document.documentElement.dataset.themeColorMode='custom';document.documentElement.style.setProperty('--identity-header','#67432e');document.documentElement.style.setProperty('--identity-text-on-nav','#fff4e6');document.documentElement.style.setProperty('--identity-soft','#f1e6da');document.documentElement.style.setProperty('--identity-text','#3b2823');document.documentElement.style.setProperty('--identity-accent','#aa774d')");
    await until("getComputedStyle(window.qaStrip().querySelector('.family-stats-strip__fund')).backgroundColor==='rgb(103, 67, 46)'");
    assert.equal(await evaluate("getComputedStyle(window.qaStrip().querySelector('.family-stats-strip__fund')).color"),'rgb(255, 244, 230)',`${name}: fund text follows identity colors`);
    await evaluate("document.documentElement.classList.add('dark');document.documentElement.style.setProperty('--identity-soft','#211923');document.documentElement.style.setProperty('--identity-text','#f5ebdf')");
    await until("getComputedStyle(window.qaStrip().querySelector('.family-stats-strip__metrics')).backgroundColor==='rgb(33, 25, 35)'");
    await until("getComputedStyle(window.qaStrip().querySelector('.family-stats-strip__metric')).color==='rgb(245, 235, 223)'");
    console.log(`PASS ${name}: connected layout, one visible summary, read-only input behavior, live values, large numbers, identity and dark mode`);
  }
  assert.deepEqual(errors,[],'No statistics runtime errors');
  console.log('All actual read-only statistics Chrome checks passed');
} finally {
  websocket?.close();chrome.kill('SIGTERM');await new Promise(resolve=>server.close(resolve));rmSync(temporary,{recursive:true,force:true});
}
