import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, globSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { build } from "esbuild";

const prepareOnly = process.argv.includes("--prepare-only");
const chromePath = process.env.CHROME_PATH || ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find(existsSync);
if (!chromePath && !prepareOnly) throw Error("Preinstalled Chrome is required for crystal appearance checks");
const temporary = mkdtempSync(join(tmpdir(), "alsaif-crystal-qa-"));
const output = join(temporary, "assets");
const compiled = [...globSync(".output/public/**/styles-*.css")];
assert.ok(compiled.length, "Build the app before its component checks");
const root = readFileSync("src/routes/__root.tsx", "utf8");
const imports = new Map([...root.matchAll(/import (\w+) from "\.\.\/([^"?]+\.css)\?url";/g)].map((m) => [m[1], `src/${m[2]}`]));
const ordered = [...root.matchAll(/href:(\w+Css)/g)].map((m) => imports.get(m[1])).filter(Boolean);
const readStyles = (path) => readFileSync(path, "utf8").replace(/@import\s+["']([^"']+\.css)["'];/g, (_, relative) => readStyles(resolve(dirname(path), relative)));
const css = [readFileSync(compiled[0], "utf8"), ...ordered.filter((p) => p !== "src/styles.css").map(readStyles)].join("\n");
await build({
  entryPoints: ["scripts/fixtures/crystal-appearance.tsx"],
  bundle: true, format: "iife", platform: "browser", outdir: output, entryNames: "fixture",
  publicPath: "/__qa/", loader: { ".webp": "file" }, tsconfig: "tsconfig.json",
  plugins: [{
    name: "fixture-navigation-and-daylight",
    setup(builder) {
      builder.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({ path: "router", namespace: "qa" }));
      builder.onResolve({ filter: /^@\/hooks\/use-council-oasis$/ }, () => ({ path: "clock", namespace: "qa" }));
      builder.onLoad({ filter: /.*/, namespace: "qa" }, ({ path }) => ({
        loader: "jsx", resolveDir: process.cwd(),
        contents: path === "clock" ? `export const useCouncilOasis=()=>({period:'day',greeting:'مساء النور',source:'fallback'});` : `import React from 'react';export function Link({to,children,...props}){return <a {...props} href={to}>{children}</a>}`,
      }));
    },
  }],
});
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
html,body{margin:0}body{background:var(--background);color:var(--foreground)}.qa-settings{padding:24px;margin:24px auto;max-width:850px}.qa-open-colors{padding:12px 20px;margin-top:20px;border-radius:12px}.qa-controls{display:grid;gap:16px;margin-top:24px;padding-top:24px;border-top:1px solid var(--border)}.qa-switch-row{display:flex;justify-content:space-between;align-items:center}.qa-tablet-content{display:contents}.desktop-overview-shell{min-height:0!important}.app-shell-content{padding-bottom:120px}.app-shell-header img{width:48px;height:48px;border-radius:50%}.app-shell-header:not(.family-seal-header){display:flex;gap:18px;align-items:center;justify-content:space-between;padding:16px}.app-shell-header button{min-height:44px;min-width:44px}.dashboard-faith-strip p,.desktop-faith-strip p{margin:12px;text-align:center}
</style><link rel="stylesheet" href="/__qa/fixture.css"></head><body><div id="app"></div><script src="/__qa/fixture.js"></script></body></html>`;
if (prepareOnly) {
  rmSync(temporary, { recursive: true, force: true });
  console.log("Actual crystal material, settings, seal, wide hero and paper fixture compiled");
  process.exit(0);
}
const server = createServer((request, response) => {
  if (request.url === "/logo-home.png") { response.setHeader("Content-Type", "image/png"); response.end(readFileSync("public/logo-home.png")); return; }
  if (request.url.startsWith("/__qa/")) {
    const file = join(output, request.url.slice(6));
    if (!file.startsWith(output) || !existsSync(file)) { response.writeHead(404); response.end(); return; }
    response.setHeader("Content-Type", file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "image/webp");
    response.end(readFileSync(file)); return;
  }
  response.setHeader("Content-Type", "text/html;charset=utf-8"); response.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const chrome = spawn(chromePath, ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=0", `--user-data-dir=${join(temporary, "profile")}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
let websocket;
try {
  const debuggerURL = await new Promise((resolve, reject) => {
    let buffer = ""; const timeout = setTimeout(() => reject(Error("Chrome start timeout")), 20000);
    chrome.stderr.on("data", (data) => { buffer += data; const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buffer); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    chrome.on("exit", (code) => { clearTimeout(timeout); reject(Error(`Chrome exited ${code}`)); });
  });
  const debug = new URL(debuggerURL);
  const targets = await (await fetch(`http://${debug.host}/json/list`)).json();
  websocket = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errors = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => { const number = ++id; pending.set(number, { resolve, reject }); websocket.send(JSON.stringify({ id: number, method, params })); });
  websocket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) { const request = pending.get(message.id); if (request) { pending.delete(message.id); message.error ? request.reject(Error(JSON.stringify(message.error))) : request.resolve(message.result); } }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  });
  await new Promise((resolve) => websocket.addEventListener("open", resolve, { once: true }));
  const evaluate = async (expression) => { const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const until = async (expression) => { for (let n = 0; n < 150; n++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise((resolve) => setTimeout(resolve, 40)); } throw Error(`Timed out: ${expression}`); };
  const settle = () => evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,500))))");
  const clickWithMouse = async (selector) => {
    const point = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
  };
  const capture = async (name) => { const { cssContentSize } = await send("Page.getLayoutMetrics"); const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: cssContentSize.width, height: Math.min(cssContentSize.height, 2400), scale: 1 } }); writeFileSync(`test-results/crystal/${name}.png`, Buffer.from(image.data, "base64")); };
  const paperSnapshot = async () => {
    const clip = await evaluate("(()=>{const r=document.querySelector('.family-services-paper').getBoundingClientRect();return{x:r.x,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
    return (await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip })).data;
  };
  const visualDifference = (before, after) => evaluate(`(async()=>{
    const pixels=async(raw)=>{const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(raw),c=>c.charCodeAt(0))],{type:'image/png'}));const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();return ctx.getImageData(0,0,canvas.width,canvas.height).data};
    const [a,b]=await Promise.all([pixels(${JSON.stringify(before)}),pixels(${JSON.stringify(after)})]);let changed=0,total=0,delta=0;for(let i=0;i<a.length;i+=16){const d=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;total++;delta+=d;if(d>12)changed++}return{fraction:changed/total,mean:delta/total};
  })()`);
  await send("Page.enable"); await send("Runtime.enable");
  mkdirSync("test-results/crystal", { recursive: true });
  for (const [name, width, height, tablet] of [["phone",390,1000,false],["ipad-portrait",834,1194,false],["ipad-landscape",1024,768,true],["ipad-pro-landscape",1366,1024,true],["desktop",1440,1000,false]]) {
    try {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      await send("Page.navigate", { url: `http://127.0.0.1:${port}/?reset=1${tablet ? "&tablet=1" : ""}` });
      await until("window.fixtureReady&&document.querySelector('.interface-material-option')&&document.querySelector('.family-services-paper')");
      await evaluate(`history.replaceState(null,'','/${tablet ? "?tablet=1" : ""}');window.qaLayout=()=>{const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y+scrollY,w:r.width,h:r.height}};return{hero:rect(document.querySelector('.council-oasis-scene')),paper:rect(document.querySelector('.family-services-paper')),header:rect(document.querySelector('.app-shell-header-wrap')),cols:[...document.querySelectorAll('.family-services-paper__primary a')].map(n=>Math.round(n.getBoundingClientRect().y))}};`);
      await settle();
      assert.equal(await evaluate("document.documentElement.dataset.interfaceMaterial"), undefined, `${name}: classic is the default`);
      const classic = await evaluate("qaLayout()");
      const classicPaper = await paperSnapshot();
      await capture(`${name}-classic`);
      await evaluate("document.querySelector('[data-material=crystal]').click()");
      await settle();
      assert.equal(await evaluate("document.documentElement.dataset.interfaceMaterial"), "crystal");
      assert.notEqual(await evaluate("getComputedStyle(document.querySelector('.qa-open-colors')).backgroundColor"), "rgba(0, 0, 0, 0)", `${name}: action buttons retain a solid identity fill under the sheen`);
      const crystal = await evaluate("qaLayout()");
      for (const block of ["hero","paper","header"]) for (const key of ["x","y","w","h"]) assert.ok(Math.abs(crystal[block][key] - classic[block][key]) < 1, `${name}: material preserves ${block}/${key}`);
      assert.ok(crystal.paper.y >= crystal.hero.y + crystal.hero.h - 1, `${name}: services stay below the full-width scene`);
      if (width >= 970) assert.equal(new Set(crystal.cols).size, 1, `${name}: all four services remain on one horizontal row`);
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.council-portal-copy')).backgroundColor"), "rgba(0, 0, 0, 0)", `${name}: no box around the name`);
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.council-portal-copy')).backdropFilter"), "none");
      assert.ok(await evaluate(`document.documentElement.scrollWidth <= ${width}+2`), `${name}: no horizontal overflow`);
      const difference = await visualDifference(classicPaper, await paperSnapshot());
      assert.ok(difference.fraction > .22 && difference.mean > 7, `${name}: glass must visibly change the services surface, got ${JSON.stringify(difference)}`);
      assert.match(await evaluate("getComputedStyle(document.querySelector('.qa-settings')).backdropFilter"), /blur\(24px\)/, `${name}: internal pages use the full material`);
      await evaluate("document.querySelector('.qa-search').value='العائلة';document.querySelector('[role=switch]').click()");
      // Radix tabs activate on pointer-down; HTMLElement.click() omits that event.
      await clickWithMouse('[role=tab][data-state=inactive]');
      await until("document.querySelector('[role=tabpanel][data-state=active]')?.textContent.includes('المحفوظة')");
      assert.equal(await evaluate("document.querySelector('[role=switch]').getAttribute('aria-checked')"), "false", `${name}: glass switch remains interactive`);
      assert.match(await evaluate("document.querySelector('[role=tabpanel][data-state=active]').textContent"), /المحفوظة/, `${name}: segmented controls remain interactive`);
      await evaluate("document.querySelector('.qa-open-details').click()");
      await until("document.querySelector('.qa-details')"); await settle();
      assert.match(await evaluate("getComputedStyle(document.querySelector('.qa-details')).backgroundImage"), /gradient/, `${name}: portal dialog gets liquid glass`);
      assert.match(await evaluate("getComputedStyle(document.querySelector('.qa-details input')).backgroundImage"), /gradient/, `${name}: portaled form fields share the material`);
      await capture(`${name}-dialog`);
      await evaluate("document.querySelector('.qa-details > button').click()");
      await until("!document.querySelector('.qa-details')");
      await evaluate("scrollTo(0,0)"); await settle();
      await capture(`${name}-crystal`);
      await send("Page.reload", {});
      await until("window.fixtureReady&&document.querySelector('[data-material=crystal][aria-pressed=true]')");
      assert.equal(await evaluate("document.documentElement.dataset.interfaceMaterial"), "crystal", `${name}: reload retains the choice`);
      for (const color of await evaluate("qaThemes")) {
        await evaluate(`qaTheme('${color}',false)`); await settle();
        assert.equal(await evaluate("document.documentElement.dataset.interfaceMaterial"), "crystal", `${name}/${color}: identity choice preserves crystal`);
      }
      await evaluate("qaTheme('heritage-maroon',true)"); await settle();
      await capture(`${name}-dark`);
      await evaluate("qaCustom()"); await settle();
      assert.equal(await evaluate("document.documentElement.dataset.interfaceMaterial"), "crystal");
      await evaluate("document.querySelector('.qa-open-colors').click()");
      await until("document.querySelector('.theme-customizer-close')"); await settle();
      const close = await evaluate("(()=>{const n=document.querySelector('.theme-customizer-close');n.scrollIntoView({block:'nearest'});const r=n.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{visible:r.top>=0&&r.bottom<=innerHeight,hit:n===hit||n.contains(hit)}})()");
      assert.equal(close.visible && close.hit, true, `${name}: close stays visible above the glass`);
      await evaluate("document.querySelector('.theme-customizer-close').click()");
      await until("!document.querySelector('.theme-customizer-close')");
      await evaluate("qaTheme('emerald',false)"); await settle();
      await evaluate("document.querySelector('.family-services-paper__toggle').click()");
      await until("document.querySelector('.family-services-paper').dataset.expanded==='true'"); await settle();
      assert.equal(await evaluate("document.querySelectorAll('.family-services-paper a').length"), 13, `${name}: all services and paper folding remain available`);
      await capture(`${name}-expanded`);
      await evaluate("document.querySelector('.family-services-paper__toggle').click();document.querySelector('[data-material=classic]').click()"); await settle();
      assert.equal(await evaluate("document.documentElement.dataset.interfaceMaterial"), undefined, `${name}: classic clears crystal styling`);
      if (name === "desktop") {
        assert.equal(await evaluate("matchMedia('(hover: hover) and (pointer: fine)').matches"), true, "desktop fixture exposes the simulated mouse capability");
        await evaluate("document.querySelector('[data-material=crystal]').click();document.querySelector('.qa-open-colors').scrollIntoView({block:'center'})"); await settle();
        const button = await evaluate("(()=>{const r=document.querySelector('.qa-open-colors').getBoundingClientRect();return{x:r.x+r.width*.7,y:r.y+r.height*.4}})()");
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: button.x, y: button.y });
        await settle();
        const pointerState = await evaluate(`(()=>{const n=document.querySelector('.qa-open-colors');return{fine:matchMedia('(hover: hover) and (pointer: fine)').matches,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,hit:document.elementFromPoint(${button.x},${button.y})?.className,highlight:n.style.getPropertyValue('--liquid-x')}})()`);
        writeFileSync("test-results/crystal/desktop-pointer.json", JSON.stringify(pointerState));
        await until("document.querySelector('.qa-open-colors').style.getPropertyValue('--liquid-x')");
        await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
        await until("!document.querySelector('.qa-open-colors').style.getPropertyValue('--liquid-x')");
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.qa-open-colors')).transitionDuration"), "0s", "reduced motion disables fluid interaction");
        await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] }); await settle();
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.qa-settings')).getPropertyValue('--crystal-surface').trim() === getComputedStyle(document.documentElement).getPropertyValue('--card').trim()"), true, "reduced transparency restores an opaque surface");
        await send("Emulation.setEmulatedMedia", { features: [] });
        await evaluate("document.querySelector('[data-material=classic]').click()"); await settle();
        assert.equal(await evaluate("document.querySelector('.qa-open-colors').style.getPropertyValue('--liquid-x')"), "", "classic removes dynamic highlights");
      }
      console.log(`${name}: visible glass difference ${Math.round(difference.fraction * 100)}%, unchanged layout, forms, tabs, switch, portal, seven identities, dark/custom, persistence and folding passed`);
    } catch (error) { await capture(`${name}-failure`).catch(() => {}); throw error; }
  }
  assert.deepEqual(errors, [], "No component runtime errors");
} finally {
  websocket?.close(); chrome.kill("SIGKILL"); server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve)); rmSync(temporary, { recursive: true, force: true });
}
