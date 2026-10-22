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
import { dirname, join, resolve } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { build } from "esbuild";

const prepareOnly = process.argv.includes("--prepare-only");
const chromePath =
  process.env.CHROME_PATH ||
  ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find(existsSync);
if (!chromePath && !prepareOnly)
  throw Error("Preinstalled Chrome is required for paper services checks");
const temporary = mkdtempSync(join(tmpdir(), "alsaif-services-paper-qa-"));
const output = join(temporary, "assets");
const compiled = [...globSync(".output/public/**/styles-*.css")];
assert.ok(compiled.length, "Build the app before its component checks");
const rootSource = readFileSync("src/routes/__root.tsx", "utf8");
const imports = new Map(
  [...rootSource.matchAll(/import (\w+) from "\.\.\/([^"?]+\.css)\?url";/g)].map((match) => [
    match[1],
    `src/${match[2]}`,
  ]),
);
const ordered = [...rootSource.matchAll(/href:(\w+Css)/g)]
  .map((match) => imports.get(match[1]))
  .filter(Boolean);
const readStyles = (path) =>
  readFileSync(path, "utf8").replace(/@import\s+["']([^"']+\.css)["'];/g, (_, relative) =>
    readStyles(resolve(dirname(path), relative)),
  );
const css = [
  readFileSync(compiled[0], "utf8"),
  ...ordered.filter((path) => path !== "src/styles.css").map(readStyles),
].join("\n");
await build({
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';
      import {FamilyServicesPaper} from './src/components/dashboard/family-services-paper';
      import {QuickActionsBanner} from './src/components/quick-actions-banner';
      import {applyThemePreference,createPresetThemePreference,createCustomThemePreference} from './src/lib/theme-preferences';
      const tablet=new URLSearchParams(location.search).has('tablet');
      document.documentElement.dataset.dashboardTabletLandscape=String(tablet);
      const desktop=innerWidth>=1200&&!tablet;
      window.qaTheme=(mode='light')=>{document.documentElement.classList.toggle('dark',mode==='dark');applyThemePreference(mode==='custom'?{...createCustomThemePreference(),textId:'royal-copper',iconId:'family-ivory',surfaceId:'muted-palm',backgroundId:'family-ivory',accentId:'royal-gold'}:createPresetThemePreference('emerald'))};
      window.qaTheme();
      createRoot(document.getElementById('app')).render(<main className="app-shell-main"><div className="app-shell-content"><div className="dashboard-page max-w-6xl mx-auto space-y-12">{desktop?<div className="desktop-rebuild-shell"><div className="desktop-rebuild-root"><section className="desktop-overview-shell"><FamilyServicesPaper className="desktop-services-panel"/></section></div></div>:null}<QuickActionsBanner/><section id="qa-after"><h2>آخر أخبار المجلس</h2></section></div></div></main>);
      window.fixtureReady=true;`,
    resolveDir: process.cwd(),
    sourcefile: "family-services-paper-qa.tsx",
    loader: "tsx",
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  outdir: output,
  entryNames: "fixture",
  publicPath: "/__qa/",
  tsconfig: "tsconfig.json",
  plugins: [
    {
      name: "local-service-navigation",
      setup(builder) {
        builder.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({
          path: "router",
          namespace: "qa",
        }));
        builder.onLoad({ filter: /.*/, namespace: "qa" }, () => ({
          loader: "jsx",
          resolveDir: process.cwd(),
          contents: `import React from 'react';export function Link({to,children,...props}){return <a {...props} href={to}>{children}</a>}export const useRouterState=({select})=>select({location:{pathname:'/dashboard'}});`,
        }));
      },
    },
  ],
});
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\nhtml,body{margin:0}body{background:var(--background);color:var(--foreground)}#qa-after{margin-block:24px;min-height:160px;padding:24px;color:var(--foreground);background:var(--card)}.app-shell-content{padding:24px}.desktop-overview-shell{min-height:0!important}@media(max-width:620px){.app-shell-content{padding:10px}}</style><link rel="stylesheet" href="/__qa/fixture.css"></head><body><div id="app"></div><script src="/__qa/fixture.js"></script></body></html>`;
if (prepareOnly) {
  rmSync(temporary, { recursive: true, force: true });
  console.log("Actual responsive paper services fixture compiled");
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
  websocket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
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
    for (let n = 0; n < 150; n++) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw Error(`Timed out: ${expression}`);
  };
  const settle = () =>
    evaluate(
      "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,100))))",
    );
  const screenshot = async (name) => {
    await evaluate("qaPaper.scrollIntoView({block:'start'})");
    await settle();
    const result = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    writeFileSync(`test-results/services-paper/${name}.png`, Buffer.from(result.data, "base64"));
  };
  await send("Page.enable");
  await send("Runtime.enable");
  mkdirSync("test-results/services-paper", { recursive: true });
  const routes = [
    "/finance",
    "/tasks",
    "/trips",
    "/meetings",
    "/family-occasions",
    "/majlis",
    "/archive",
    "/calendar",
    "/chat",
    "/community",
    "/family-tree",
    "/vault",
    "/faith",
  ];
  for (const [name, width, height, tablet] of [
    ["small-phone", 320, 900, false],
    ["phone", 390, 1000, false],
    ["ipad-portrait", 834, 1194, false],
    ["ipad-landscape", 1024, 768, true],
    ["ipad-pro-landscape", 1366, 1024, true],
    ["desktop", 1440, 1000, false],
  ]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Emulation.setTouchEmulationEnabled", { enabled: width < 1400, maxTouchPoints: 5 });
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
    });
    await send("Page.navigate", { url: `http://127.0.0.1:${port}/${tablet ? "?tablet=1" : ""}` });
    await until("window.fixtureReady&&document.querySelector('.family-services-paper__toggle')");
    await settle();
    await evaluate(
      `window.qaPapers=[...document.querySelectorAll('.family-services-paper')].filter(n=>getComputedStyle(n).display!=='none');window.qaPaper=qaPapers[0];window.qaToggle=qaPaper.querySelector('button');window.qaFolds=qaPaper.querySelector('.family-services-paper__folds');window.qaRect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y+scrollY,width:r.width,height:r.height,right:r.right,bottom:r.bottom+scrollY}};window.qaSnapshot=()=>({paper:qaRect(qaPaper),after:qaRect(document.getElementById('qa-after')),scroll:document.documentElement.scrollWidth,toggle:qaRect(qaToggle),internal:[qaPaper,qaFolds,...qaPaper.querySelectorAll('.family-services-paper__fold')].some(n=>/auto|scroll/.test(getComputedStyle(n).overflowY))});window.qaContrast=()=>{const c=document.createElement('canvas').getContext('2d');const l=color=>{c.fillStyle=color;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data].slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)};const contrast=(a,b)=>(Math.max(l(a),l(b))+.05)/(Math.min(l(a),l(b))+.05);const text=qaPaper.querySelector('.family-services-paper__label'),icon=qaPaper.querySelector('.family-services-paper__icon');return{text:contrast(getComputedStyle(text).color,getComputedStyle(qaPaper.querySelector('.family-services-paper__sheet')).backgroundColor),button:contrast(getComputedStyle(qaToggle).color,getComputedStyle(qaToggle).backgroundColor),icon:contrast(getComputedStyle(icon).color,getComputedStyle(icon).backgroundColor)}};`,
    );
    assert.equal(await evaluate("qaPapers.length"), 1, `${name}: one services directory`);
    assert.deepEqual(
      await evaluate("[...qaPaper.querySelectorAll('a')].map(a=>a.getAttribute('href'))"),
      routes,
      `${name}: all actual destinations retained`,
    );
    assert.equal(
      await evaluate("qaPaper.querySelectorAll('.family-services-paper__primary a').length"),
      4,
    );
    assert.equal(
      await evaluate("qaFolds.inert&&qaFolds.getAttribute('aria-hidden')==='true'"),
      true,
    );
    await evaluate('qaFolds.querySelector("a").focus()');
    assert.equal(
      await evaluate("qaFolds.contains(document.activeElement)"),
      false,
      `${name}: hidden services cannot receive focus`,
    );
    const before = await evaluate("qaSnapshot()");
    assert.ok(before.scroll <= width + 2, `${name}: collapsed directory fits`);
    assert.ok(before.toggle.height >= 44, `${name}: touch target`);
    await screenshot(`${name}-collapsed`);
    await evaluate("qaToggle.click()");
    await settle();
    const during = await evaluate("qaSnapshot()");
    assert.ok(
      during.paper.height > before.paper.height,
      `${name}: unfolding changes paper geometry`,
    );
    await until(
      "[...qaPaper.querySelectorAll('.family-services-paper__fold,.family-services-paper__fold-face')].every(n=>n.getAnimations().length===0)&&getComputedStyle(qaPaper.querySelector('.family-services-paper__fold:last-child .family-services-paper__fold-face')).opacity==='1'",
    );
    await settle();
    const after = await evaluate("qaSnapshot()");
    assert.ok(after.paper.height > before.paper.height + 150, `${name}: all paper folds appear`);
    assert.ok(
      Math.abs(after.after.y - before.after.y - (after.paper.height - before.paper.height)) < 3,
      `${name}: subsequent content moves in normal page flow`,
    );
    assert.equal(after.internal, false, `${name}: no independent services scroller`);
    assert.ok(after.scroll <= width + 2, `${name}: expanded directory fits`);
    assert.equal(
      await evaluate("qaFolds.inert||qaFolds.getAttribute('aria-hidden')!=='false'"),
      false,
    );
    const fit = await evaluate(
      `(()=>{const outer=qaRect(qaPaper.querySelector('.family-services-paper__sheet'));const links=[...qaPaper.querySelectorAll('a')];const labels=[...qaPaper.querySelectorAll('.family-services-paper__label')];return{inside:links.every(n=>{const r=qaRect(n);return r.x>=outer.x&&r.right<=outer.right+1&&r.y>=outer.y&&r.bottom<=outer.bottom+1&&r.height>=44}),labels:labels.every(n=>n.scrollWidth<=n.clientWidth+1),overlap:links.some((a,i)=>links.slice(i+1).some(b=>{const ra=qaRect(a),rb=qaRect(b);return Math.min(ra.right,rb.right)-Math.max(ra.x,rb.x)>1&&Math.min(ra.bottom,rb.bottom)-Math.max(ra.y,rb.y)>1}))}})()`,
    );
    assert.equal(fit.inside, true, `${name}: all services fit the paper`);
    assert.equal(fit.labels, true, `${name}: Arabic labels remain visible`);
    assert.equal(fit.overlap, false, `${name}: services do not overlap`);
    await screenshot(`${name}-expanded`);
    for (const mode of ["light", "dark", "custom"]) {
      await evaluate(`qaTheme('${mode}')`);
      await settle();
      const contrast = await evaluate("qaContrast()");
      assert.ok(contrast.text >= 4.5, `${name}/${mode}: readable service labels ${contrast.text}`);
      assert.ok(contrast.button >= 4.5, `${name}/${mode}: readable toggle ${contrast.button}`);
      assert.ok(contrast.icon >= 3, `${name}/${mode}: visible service icon ${contrast.icon}`);
      if (mode !== "light") await screenshot(`${name}-${mode}`);
    }
    await evaluate("qaToggle.focus()");
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
    });
    await until("qaToggle.getAttribute('aria-expanded')==='false'");
    assert.equal(await evaluate("qaFolds.inert"), true);
    await until("getComputedStyle(qaFolds).visibility==='hidden'");
    await settle();
    assert.ok(
      Math.abs((await evaluate("qaSnapshot()")).paper.height - before.paper.height) < 3,
      `${name}: folding restores compact height`,
    );
    await evaluate(
      "new Promise(resolve=>{qaToggle.click();setTimeout(()=>{qaToggle.click();requestAnimationFrame(resolve)},150)})",
    );
    await until("qaToggle.getAttribute('aria-expanded')==='false'");
    await until("getComputedStyle(qaFolds).visibility==='hidden'");
    await settle();
    assert.ok(
      Math.abs((await evaluate("qaSnapshot()")).paper.height - before.paper.height) < 3,
      `${name}: rapid reversal settles closed`,
    );
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await evaluate("qaToggle.click()");
    await settle();
    assert.equal(
      await evaluate(
        "getComputedStyle(qaPaper.querySelector('.family-services-paper__fold')).transitionDuration",
      ),
      "0s",
      `${name}: respects reduced motion`,
    );
    console.log(
      `${name}: paper geometry, 13 destinations, RTL labels, focus, folding, themes and reduced motion passed`,
    );
  }
  assert.deepEqual(errors, [], "No component runtime errors");
} finally {
  websocket?.close();
  chrome.kill("SIGKILL");
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  rmSync(temporary, { recursive: true, force: true });
}
