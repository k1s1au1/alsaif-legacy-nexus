import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, globSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { stripTypeScriptTypes } from "node:module";

// GitHub's Ubuntu runner already supplies Chrome. Use CDP directly so this
// regression check adds no browser/test package to the application.
const chromePath = process.env.CHROME_PATH || ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
if (!chromePath) throw Error("Chrome is required for display-layout browser checks");
const source = ["display-preference", "desktop-media", "display-layout"].map(name =>
  stripTypeScriptTypes(readFileSync(`src/lib/${name}.ts`, "utf8"))
    .replace(/^import .*;\n/gm, "").replace(/^export /gm, ""),
).join("\n");
const compiled = [...globSync(".output/public/**/styles-*.css"), ...globSync("dist/**/styles-*.css")];
assert.ok(compiled.length, "Run the web build before the browser checks (compiled Tailwind is required)");
const rootSource = readFileSync("src/routes/__root.tsx", "utf8");
const imports = new Map([...rootSource.matchAll(/import (\w+) from "\.\.\/([^"?]+\.css)\?url";/g)].map(m => [m[1], `src/${m[2]}`]));
const ordered = [...rootSource.matchAll(/href:(\w+Css)/g)].map(m => imports.get(m[1])).filter(Boolean);
const css = [readFileSync(compiled[0], "utf8"),
  ...ordered.filter(path => path !== "src/styles.css").map(path => readFileSync(path, "utf8")),
  ...["src/settings-responsive.css", "src/chat-workspace.css", "src/dashboard-reference-exact.css"].map(path => readFileSync(path, "utf8")),
].join("\n");
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style>
<style>html,body{margin:0}#legacy-preview{min-height:1100px}#desktop-preview{display:none}#desktop-preview.desktop-rebuild-shell{display:block}#primary-nav{height:52px;background:var(--primary);color:white}.fixture-panel{border:1px solid var(--border);padding:18px}#popup{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:620px;max-width:calc(100vw - 40px);background:var(--card);border:2px solid var(--primary);padding:24px;z-index:9000}#popup button{padding:16px}#late-route{display:none}@media (min-width:1200px){#late-route{display:grid;grid-template-columns:1fr 1fr}}</style></head><body>
<main class="app-shell-main"><div class="app-shell-header-wrap"><header id="primary-nav">لوحة العائلة — واجهة الكمبيوتر</header></div><div class="app-shell-content p-4 md:p-8 lg:p-12">
<div id="legacy-preview" class="dashboard-page max-w-6xl mx-auto space-y-12"><section class="dashboard-spiritual">نفحات إيمانية</section><section class="dashboard-portal-hero">خدمات العائلة</section></div>
<div id="desktop-preview"><div class="desktop-rebuild-root"><div class="desktop-overview-shell"><article class="desktop-hero-card"><div class="desktop-hero-copy"><h1>لوحة العائلة</h1><p>التواصل والاجتماعات والمناسبات</p></div></article><article class="desktop-services-panel">خدمات العائلة</article></div><div class="settings-layout"><nav class="settings-section-nav">الإعدادات</nav><section class="settings-sections fixture-panel"><h2>طريقة العرض</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-3"><button id="choose-auto">تلقائي</button><button id="choose-desktop">عرض الكمبيوتر</button></div></section></div><div class="chat-workspace"><div class="chat-layout"><aside class="chat-sidebar">المحادثات</aside><div class="chat-thread">الرسائل</div></div></div><div id="late-route">المناسبات</div></div></div>
</div><div id="bottom-dock" class="app-shell-bottom-dock md:hidden fixed">الرئيسية · خدمات العائلة · المزيد</div></main>
<div id="return-control" class="display-mode-return" role="region"><span>عرض الكمبيوتر</span><button id="return-auto">الرجوع للتلقائي</button></div>
<script>${source}
function renderChoice(){const v=getDisplayViewport();const desktop=v.width>=1200&&!v.touch;document.getElementById('desktop-preview').className=desktop?'desktop-rebuild-shell':'';document.getElementById('return-control').hidden=getDisplayMode()!=='desktop';document.getElementById('return-control').style.display=getDisplayMode()==='desktop'?'flex':'none'}
document.getElementById('choose-auto').onclick=()=>saveDisplayMode('auto');document.getElementById('choose-desktop').onclick=()=>saveDisplayMode('desktop');document.getElementById('return-auto').onclick=()=>saveDisplayMode('auto');
window.stopDisplayLayout=mountDisplayLayout();subscribeDisplayMode(renderChoice);window.addEventListener('resize',renderChoice);renderChoice();window.fixtureReady=true;
</script></body></html>`;

const server = createServer((request, response) => {
  response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const profile = mkdtempSync(join(tmpdir(), "alsaif-display-browser-"));
const chrome = spawn(chromePath, ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
let socket;
try {
  const address = await new Promise((resolve, reject) => {
    let output = ""; const timeout = setTimeout(() => reject(Error("Chrome startup timed out")), 20000);
    chrome.on("error", reject);
    chrome.on("exit", code => reject(Error(`Chrome exited before startup: ${code}`)));
    chrome.stderr.on("data", data => {
      output += data;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const endpoint = new URL(address); const target = await (await fetch(`http://${endpoint.host}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0;
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data); if (!message.id) return;
    const entry = pending.get(message.id); if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(Error(JSON.stringify(message.error))); else entry.resolve(message.result);
  });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const request = ++id; pending.set(request, { resolve, reject }); socket.send(JSON.stringify({ id: request, method, params })); });
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value;
  };
  const settle = () => evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,80))))");
  const navigate = async () => {
    await evaluate("window.fixtureReady=false");
    await send("Page.navigate", { url: `http://127.0.0.1:${port}/fixture` });
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if (await evaluate("document.readyState==='complete' && window.fixtureReady===true")) break;
      } catch { /* The old context may disappear while navigation commits. */ }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(await evaluate("window.fixtureReady"), true); await settle();
  };
  const viewport = async (width, height, touch) => {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false, screenWidth: width, screenHeight: height });
    await send("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
  };
  const snapshot = () => evaluate(`(()=>{const ids=['desktop-preview','primary-nav','bottom-dock','legacy-preview'];const result={};for(const id of ids){const e=document.getElementById(id);const c=getComputedStyle(e);result[id]={display:c.display}}for(const selector of ['.desktop-overview-shell','.desktop-hero-card','.settings-layout','.chat-layout']){const c=getComputedStyle(document.querySelector(selector));result[selector]={display:c.display,columns:c.gridTemplateColumns,padding:c.padding,gap:c.gap,fontSize:c.fontSize}}return result})()`);
  await send("Page.enable");
  await viewport(1440, 900, false); await navigate();
  const desktopBaseline = await snapshot();
  assert.equal(desktopBaseline["desktop-preview"].display, "block");
  mkdirSync("test-results/display-layout", { recursive: true });
  for (const [name, width, height] of [["phone", 425, 900], ["tablet-portrait", 834, 1194], ["chrome-desktop-site", 980, 2200]]) {
    await evaluate("saveDisplayMode('auto')"); await viewport(width, height, true); await navigate();
    const automatic = await snapshot();
    const originalCSS = await evaluate("Array.from(document.styleSheets).map(sheet=>Array.from(sheet.cssRules).map(rule=>rule.cssText).join('')).join('')");
    await evaluate("saveDisplayMode('desktop')"); await settle();
    const forced = await snapshot();
    assert.deepEqual(forced, desktopBaseline, `${name}: forced desktop must use the existing desktop styles`);
    const metrics = await evaluate(`(()=>{const scale=getDisplayScale();const body=document.body.getBoundingClientRect();const button=document.getElementById('return-auto');const r=button.getBoundingClientRect();return{width:innerWidth,scale,canvasWidth:body.width/scale,bodyWidth:body.width,buttonHeight:r.height,buttonX:r.x,buttonRight:r.right,buttonBottom:r.bottom,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===button||button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})()`);
    assert.ok(Math.abs(metrics.canvasWidth - 1440) < 1, `${name}: full desktop canvas width`);
    assert.ok(metrics.bodyWidth <= width + 1, `${name}: desktop canvas fits the phone/tablet`);
    assert.ok(metrics.buttonHeight >= 39 && metrics.buttonX >= 0 && metrics.buttonRight <= width && metrics.buttonBottom <= height, `${name}: escape control stays readable and on screen`);
    assert.equal(metrics.hit, true, `${name}: escape control is clickable`);
    await evaluate("const popup=document.createElement('div');popup.id='popup';popup.innerHTML='<p>نافذة الإعدادات</p><button>حفظ</button>';document.body.appendChild(popup)");
    await settle();
    const popup = await evaluate("(()=>{const r=document.getElementById('popup').getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width}})()");
    assert.ok(popup.width > 0 && popup.x >= -1 && popup.right <= width + 1 && popup.y >= -1 && popup.bottom <= height + 1, `${name}: body dialog portals fit the desktop canvas`);
    await evaluate("document.getElementById('popup').remove();const style=document.createElement('style');style.textContent='@media(width >= 75rem){#late-route{display:flex}}';document.head.appendChild(style)");
    await settle(); assert.equal(await evaluate("getComputedStyle(document.getElementById('late-route')).display"), "flex");
    const capture = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(`test-results/display-layout/${name}.png`, Buffer.from(capture.data, "base64"));
    await navigate(); assert.equal(await evaluate("getDisplayMode()"), "desktop");
    await evaluate("document.getElementById('return-auto').click()"); await settle();
    assert.equal(await evaluate("getDisplayMode()"), "auto");
    assert.deepEqual(await snapshot(), automatic, `${name}: automatic returns to its original layout`);
    assert.equal(await evaluate("Array.from(document.styleSheets).map(sheet=>Array.from(sheet.cssRules).map(rule=>rule.cssText).join('')).join('')"), originalCSS, `${name}: automatic restores every original CSS rule`);
    console.log(`PASS ${name}: desktop styling, fit, dialog portals, readable return control, reload, late styles, exact auto restoration`);
  }
  await viewport(1920, 1080, false); await navigate();
  const wide = await snapshot(); await evaluate("saveDisplayMode('desktop')"); await settle();
  assert.deepEqual(await snapshot(), wide, "a wide computer retains its original desktop styles");
  assert.equal(await evaluate("getDisplayScale()"), 1);
  console.log("PASS wide desktop: original desktop layout and scale");
} finally {
  socket?.close(); chrome.kill("SIGKILL"); server.close();
  await new Promise(resolve => setTimeout(resolve, 300));
  rmSync(profile, { recursive: true, force: true });
}
