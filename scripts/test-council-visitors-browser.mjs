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
import {OasisFamilyServices} from './src/components/dashboard/oasis-family-services';
import {QuickActionsBanner} from './src/components/quick-actions-banner';
import {applyThemePreference,createCustomThemePreference} from './src/lib/theme-preferences';
import {THEME_COLORS} from './src/lib/themes';
import {useOnlineCount} from './src/lib/presence';
import {useTodayVisitorCount} from './src/hooks/use-today-site-visits';
import {saudiVisitDay,DAILY_VISITS_QUERY_KEY} from './src/lib/daily-site-visits';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
window.qaRefresh=()=>queryClient.invalidateQueries({queryKey:DAILY_VISITS_QUERY_KEY});
const RealDate=Date;window.qaNow=RealDate.parse('2026-10-16T08:00:00+03:00');window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[window.qaNow]))}static now(){return window.qaNow}};
window.qaSetClock=iso=>{window.qaNow=RealDate.parse(iso);window.dispatchEvent(new Event('focus'))};
window.qaRoute='/dashboard';window.qaNavigations=[];window.qaThemes=THEME_COLORS.map(t=>t.id);
window.qaSetTheme=id=>applyThemePreference({mode:'preset',presetId:id});
window.qaCustomRoles=(iconId,accentId)=>applyThemePreference({...createCustomThemePreference('emerald'),iconId,accentId,backgroundId:'heritage-maroon',surfaceId:'royal-gold',textId:'heritage-maroon',navigationId:'midnight'});
window.qaSetTheme('emerald');
window.qaSeenToday=new Set(['one','two']);
window.qaAdvanceDay=()=>{window.qaNow=RealDate.parse(saudiVisitDay(new Date())+'T21:00:00Z')+50;window.qaTotal=0;window.qaSeenToday.clear();window.dispatchEvent(new Event('focus'))};
window.qaHold=location.pathname==='/loading';window.qaFail=location.pathname==='/error';window.qaWaiters=[];
window.qaRows=[{user_id:'one',last_seen_at:new Date().toISOString()},{user_id:'two',last_seen_at:'2026-01-01T00:00:00Z'}];
window.qaTotal=1248;window.qaQueries=0;
const tabletLandscape=new URLSearchParams(location.search).has('tablet');
document.documentElement.dataset.dashboardTabletLandscape=tabletLandscape?'true':'false';
window.qaUnlocated=false;
window.qaRelease=()=>{window.qaHold=false;window.qaWaiters.splice(0).forEach(resolve=>resolve())};
window.qaVisit=(id)=>{const found=window.qaRows.some(row=>row.user_id===id);if(!found)window.qaRows.push({user_id:id,last_seen_at:new Date().toISOString()});if(!window.qaSeenToday.has(id)){window.qaSeenToday.add(id);window.qaTotal++}window.qaChange({eventType:found?'UPDATE':'INSERT',new:{user_id:id,last_seen_at:new Date().toISOString()}});window.qaRefresh()};
function Fixture(){const count=useTodayVisitorCount();const online=useOnlineCount();const [name,setName]=useState('حساب المعاينة');const [show,setShow]=useState(true);const [,setUnlocated]=useState(false);window.qaSetName=setName;window.qaSetShow=setShow;window.qaSetUnlocated=value=>{window.qaUnlocated=value;setUnlocated(value)};const desktop=innerWidth>=1200&&!tabletLandscape;
const hero=<HeritagePortal3D greeting="مساء الخير" name={name} message="نصل العائلة، نحفظ الإرث، ونبني المستقبل." className={desktop?'desktop-portal-model':'dashboard-portal-model'} visitorCount={show?count:undefined}/>;
const services=<OasisFamilyServices desktop/>;
return <main className="app-shell-main relative min-h-screen"><div className="app-shell-content p-4 md:p-8 lg:p-12 pt-24 md:pt-6 mx-auto max-w-7xl"><output hidden id="qa-online">{online}</output>{desktop?<div className="desktop-rebuild-shell"><div className="desktop-rebuild-root"><section className="desktop-overview-shell"><div className="desktop-portal-stage"><PrayerMushafShortcuts desktop/>{hero}</div>{services}</section><div id="qa-after-services">آخر أخبار المجلس</div><div className="dashboard-page max-w-6xl mx-auto space-y-12"><QuickActionsBanner/></div></div></div>:<div className="dashboard-page max-w-6xl mx-auto space-y-12 pb-20 px-4 md:px-0">
{/* Match dashboard.tsx: the faith strip precedes the hero, then services. */}
<section className="dashboard-spiritual dashboard-faith-strip"><div className="dashboard-faith-meta"><div className="dashboard-faith-label"><span>نفحات إيمانية</span></div></div><p>مجلس يجمعنا على المودة</p></section>
<section className="dashboard-hero dashboard-portal-hero has-faith-shortcuts"><div className="dashboard-portal-card"><PrayerMushafShortcuts/><div className="dashboard-portal-layout">{hero}</div></div></section><QuickActionsBanner/><div id="qa-after-services">آخر أخبار المجلس</div></div>}</div><div style={{height:1100}} aria-hidden="true"/></main>}
createRoot(document.getElementById('app')).render(<QueryClientProvider client={queryClient}><Fixture/></QueryClientProvider>);window.fixtureReady=true;`;
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
              ? `export const supabase={from:()=>({select:async()=>({data:window.qaRows.map(row=>({...row}))})}),rpc:async(name)=>{if(name!=='get_today_site_visit_count')throw Error('Daily aggregate RPC required');window.qaQueries++;const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=type=>parts.find(p=>p.type===type).value;const result=window.qaFail?{data:null,error:{message:'unavailable'}}:{data:{visit_date:part('year')+'-'+part('month')+'-'+part('day'),visitor_count:window.qaTotal},error:null};if(window.qaHold)await new Promise(resolve=>window.qaWaiters.push(resolve));return result},channel:()=>{const channel={on:(event,filter,callback)=>{window.qaChange=callback;return channel},subscribe:callback=>{window.qaSubscription=status=>{callback?.(status);window.qaRefresh?.()};setTimeout(()=>window.qaSubscription('SUBSCRIBED'),0);return channel}};return channel}};`
              : path === "prayer"
                ? `export const usePrayerTimes=()=>{const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());return window.qaUnlocated?({location:null,locationLabel:'حسب موقعك',prayer:null,countdown:'',loading:false}):({location:{latitude:27,longitude:49},locationLabel:'حسب موقعك',prayer:{name:'الفجر'},countdown:'باقي ٨ ساعات',loading:false,timeZone:'Asia/Riyadh',today:{date,sunrise:date+'T05:41:00+03:00',sunset:date+'T17:12:00+03:00'}})};`
                : `import React from 'react';export const useNavigate=()=>()=>{};export const useRouterState=({select})=>select({location:{pathname:window.qaRoute}});export function Link({to,search,children,...props}){return <a {...props} href={to} onClick={event=>{event.preventDefault();window.qaNavigations.push(to)}}>{children}</a>}`,
        }));
      },
    },
  ],
});
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\nhtml,body{margin:0}body{background:var(--background);color:var(--foreground)}main{min-width:0}#qa-after-services{order:99!important;display:block!important;min-height:120px;padding:24px}</style><link rel="stylesheet" href="/__qa/fixture.css"></head><body><div id="app"></div><script src="/__qa/fixture.js"></script></body></html>`;
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
  await send("Emulation.setTimezoneOverride", { timezoneId: "Asia/Riyadh" });
  const contrastCheck = `(()=>{const c=document.createElement('canvas').getContext('2d');const luminance=color=>{c.fillStyle=color;c.fillRect(0,0,1,1);const channels=Array.from(c.getImageData(0,0,1,1).data).slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return channels.reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)};const scene=document.querySelector('.council-oasis-scene');const bg=luminance(getComputedStyle(scene).getPropertyValue('--oasis-sky'));return ['.council-portal-greeting','.council-visitor-number'].map(selector=>{const value=luminance(getComputedStyle(scene.querySelector(selector)).color);return(Math.max(value,bg)+.05)/(Math.min(value,bg)+.05)})})()`;
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
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
    "All unique visitors today, not online count or paginated presence rows",
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
  await navigate("/");
  await until("document.querySelector('.council-visitor-number').textContent==='1,248'");
  await evaluate("window.qaHold=true;window.qaRefresh();true");
  await settle();
  await evaluate("window.qaAdvanceDay()");
  await settle();
  assert.equal(await counterText(), "—", "Yesterday's count disappears immediately while the new Saudi day loads");
  await evaluate("window.qaRelease()");
  await until("document.querySelector('.council-visitor-number').textContent==='0'");
  await evaluate("window.qaVisit('one')");
  await until("document.querySelector('.council-visitor-number').textContent==='1'");
  await evaluate("window.qaVisit('one');window.qaVisit('one')");
  await settle();
  assert.equal(await counterText(), "1", "A returning account is counted again on a new day, once only");
  console.log("PASS daily unique visitors, late old-day response, Saudi rollover, repeated visits, reconnect and failed reads");
  const serviceLayout = () => evaluate(`(()=>{const root=document.querySelector('.oasis-family-services'),box=n=>{const r=n.getBoundingClientRect();return{top:r.top+scrollY,bottom:r.bottom+scrollY,left:r.left,right:r.right,width:r.width,height:r.height}};const extra=root.querySelector('.oasis-services-extra');return{root:box(root),hero:box(document.querySelector('.council-oasis-scene')),primary:box(root.querySelector('.oasis-services-primary')),toggle:box(root.querySelector('.oasis-services-toggle')),after:box(document.getElementById('qa-after-services')),extra:box(extra),expanded:root.querySelector('button').getAttribute('aria-expanded'),extraHidden:extra.hidden,scrollY,overflow:document.documentElement.scrollWidth>innerWidth+2,visiblePanels:Array.from(document.querySelectorAll('.oasis-family-services')).filter(n=>n.getBoundingClientRect().height>0).length,links:Array.from(root.querySelectorAll('.oasis-service-link')).filter(n=>n.getBoundingClientRect().height>0).map(n=>({href:n.getAttribute('href'),label:n.querySelector('strong').textContent,...box(n)}))}})()`);
  const servicePalette = () => evaluate(`(()=>{
    const root=document.querySelector('.oasis-family-services'),glass=root.querySelector('.oasis-services-glass'),ctx=document.createElement('canvas').getContext('2d');
    const pixel=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data)};
    const lum=rgb=>rgb.slice(0,3).map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
    const composite=(fg,bg)=>fg.slice(0,3).map((c,i)=>Math.round(c*fg[3]/255+bg[i]*(1-fg[3]/255)));
    const surface=pixel(getComputedStyle(glass).backgroundColor),bg=composite(surface,pixel(getComputedStyle(root).backgroundColor));
    const ink=pixel(getComputedStyle(root.querySelector('.oasis-service-link strong')).color),desc=pixel(getComputedStyle(root.querySelector('.oasis-service-description')).color),icon=pixel(getComputedStyle(root.querySelector('.oasis-service-icon')).color),line=pixel(getComputedStyle(root.querySelector('.oasis-service-link'),'::before').backgroundColor);
    // Bound contrast even when a reflection behind the glass is black or white.
    const backdrops=[[0,0,0],[255,255,255]].map(rgb=>composite(surface,rgb));
    const contrast=fg=>Math.min(...backdrops.map(b=>(Math.max(lum(fg),lum(b))+.05)/(Math.min(lum(fg),lum(b))+.05)));
    return{bg,surface,ink,icon,line,description:desc,contrast:[contrast(ink),contrast(desc),contrast(icon)]};
  })()`);
  const clickServiceToggle = async () => {
    await evaluate("document.querySelector('.oasis-services-toggle').scrollIntoView({block:'center'})"); await settle();
    const point=await evaluate("(()=>{const r=document.querySelector('.oasis-services-toggle').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
    await settle();
  };
  const deviceFailures=[];
  for (const [name, width, height, tablet = false] of [
    ["phone-small", 320, 800],
    ["phone", 390, 844],
    ["ipad-portrait", 834, 1194],
    ["ipad-landscape", 1024, 768, true],
    ["ipad-landscape-reference", 1142, 782, true],
    ["tablet-preview-landscape", 1142, 782],
    ["ipad-air-landscape", 1180, 820, true],
    ["ipad-pro-landscape", 1194, 834, true],
    ["ipad-pro-large-landscape", 1366, 1024, true],
    ["desktop", 1440, 1000],
  ]) {
    try {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Emulation.setTouchEmulationEnabled", {
      enabled: tablet,
      maxTouchPoints: 5,
    });
    await navigate(tablet ? "/?tablet=1" : "/");
    await until("document.querySelector('.council-visitor-number').textContent==='1,248'");
    await settle();
    await evaluate(
      `window.qaVisibleTower=async()=>{const sceneNode=document.querySelector('.council-oasis-scene');const node=sceneNode.querySelector('.council-oasis-layer[data-period='+sceneNode.dataset.oasisPeriod+'] img');const r=node.getBoundingClientRect(),scene=sceneNode.getBoundingClientRect();const portrait=node.naturalWidth===1086;const scale=Math.max(r.width/node.naturalWidth,r.height/node.naturalHeight);const width=node.naturalWidth*scale,height=node.naturalHeight*scale,left=r.right-width,top=r.bottom-height;const bounds=portrait?[.479,.958,.479,.867]:[.634,.932,.155,.862];return{left:left+width*bounds[0],right:left+width*bounds[1],top:top+height*bounds[2],bottom:top+height*bounds[3],width,height,offsetLeft:left-scene.left,offsetTop:top-scene.top,portrait,src:node.currentSrc}}`,
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
    if (width >= 970) {
      for (const noLocation of [true, false]) {
        await evaluate(`window.qaSetUnlocated(${noLocation})`);
        await settle();
        const shortcuts = await evaluate(
          `(async()=>{const row=document.querySelector('.faith-home-shortcuts').getBoundingClientRect();const scene=document.querySelector('.council-terrain-scene').getBoundingClientRect();const copy=document.querySelector('.council-portal-copy').getBoundingClientRect();const tower=await window.qaVisibleTower();return {rowTop:row.top,rowBottom:row.bottom,rowLeft:row.left,rowRight:row.right,sceneTop:scene.top,sceneLeft:scene.left,copyTop:copy.top,towerLeft:tower.left,links:Array.from(document.querySelectorAll('.faith-home-link')).map(link=>{const r=link.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {text:link.textContent,clickable:link.contains(hit),href:link.getAttribute('href')}})}})()`,
        );
        assert.ok(
          shortcuts.rowTop >= shortcuts.sceneTop &&
            shortcuts.rowTop <= shortcuts.sceneTop + 16 &&
            shortcuts.rowBottom <= shortcuts.copyTop + 1,
          `${name}: faith shortcuts stay inside the scene above the welcome ${JSON.stringify(shortcuts)}`,
        );
        assert.ok(
          shortcuts.rowLeft >= shortcuts.sceneLeft - 1 &&
            shortcuts.towerLeft - shortcuts.rowRight >= 16,
          `${name}: shortcut tap areas stay left of the sculpture with a clear gap ${JSON.stringify(shortcuts)}`,
        );
        assert.ok(
          shortcuts.links.every((link) => link.clickable && link.href === "/faith"),
          `${name}: both shortcuts remain tappable`,
        );
        console.log(
          `PASS ${name}: prayer/Mushafi overlay clears sculpture to its left (${noLocation ? "GPS unavailable" : "next prayer"})`,
        );
      }
      if (name === "ipad-landscape") {
        await send("Emulation.setDeviceMetricsOverride", {
          width: 768,
          height: 1024,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await settle();
        await until("Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)");
        assert.equal(
          await evaluate(
            "getComputedStyle(document.querySelector('.faith-home-shortcuts')).position",
          ),
          "absolute",
          "Portrait rotation retains its existing shortcut layout",
        );
        assert.ok(
          await evaluate("document.querySelector('.faith-home-shortcuts').getBoundingClientRect().width/document.querySelector('.council-terrain-scene').getBoundingClientRect().width>0.85"),
          "Portrait rotation restores the full-width shortcut distribution",
        );
        await send("Emulation.setDeviceMetricsOverride", {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await settle();
        await until("Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)");
        assert.equal(
          await evaluate(
            "getComputedStyle(document.querySelector('.faith-home-shortcuts')).position",
          ),
          "absolute",
          "Landscape rotation keeps the shortcuts inside the scene",
        );
        assert.ok(
          await evaluate("document.querySelector('.faith-home-shortcuts').getBoundingClientRect().width/document.querySelector('.council-terrain-scene').getBoundingClientRect().width<0.65"),
          "Landscape rotation restores the approved left-hand arrangement",
        );
      }
    }
    await evaluate("document.querySelector('.oasis-services-toggle').scrollIntoView({block:'center'})"); await settle();
    const serviceBefore=await serviceLayout();
    assert.equal(serviceBefore.visiblePanels,1,`${name}: one services panel, including desktop with its mobile replacement hidden`);
    assert.equal(serviceBefore.links.length,4,`${name}: the four primary services appear first`);
    assert.deepEqual(serviceBefore.links.map(link=>link.href),['/finance','/tasks','/trips','/meetings']);
    assert.equal(serviceBefore.extraHidden,true);
    const primaryGeometry=await evaluate("(()=>{const root=document.querySelector('.oasis-family-services'),glass=root.querySelector('.oasis-services-glass'),links=Array.from(root.querySelectorAll('.oasis-services-primary .oasis-service-link'));return{tops:links.map(n=>n.getBoundingClientRect().top),glass:getComputedStyle(glass).backdropFilter,frame:parseFloat(getComputedStyle(glass).borderTopWidth),medallions:links.map(n=>{const m=n.querySelector('.oasis-service-medallion').getBoundingClientRect();return{width:m.width,height:m.height}})}})()");
    assert.ok(Math.max(...primaryGeometry.tops)-Math.min(...primaryGeometry.tops)<1, `${name}: all four primary services share one compact row`);
    assert.ok(primaryGeometry.frame>0&&primaryGeometry.glass!=='none', `${name}: copper frame and real glass backdrop are present`);
    assert.ok(primaryGeometry.medallions.every(m=>Math.abs(m.width-m.height)<1&&m.width>=44), `${name}: icon medallions fit the compact row`);
    if(width<600)assert.ok(serviceBefore.root.height<=250, `${name}: collapsed services stay compact on mobile (${serviceBefore.root.height}px)`);

    await clickServiceToggle();
    const serviceExpanded=await serviceLayout();
    assert.equal(serviceExpanded.expanded,'true'); assert.equal(serviceExpanded.links.length,13);
    assert.ok(serviceExpanded.extra.top>=serviceExpanded.toggle.bottom,`${name}: extra services expand BELOW the trigger`);
    for(const key of ['root','hero','primary','toggle']) assert.ok(Math.abs(serviceExpanded[key].top-serviceBefore[key].top)<1,`${name}: expansion keeps existing ${key} position`);
    assert.ok(Math.abs(serviceExpanded.scrollY-serviceBefore.scrollY)<2,`${name}: expansion does not jump the viewport`);
    assert.ok(serviceExpanded.after.top-serviceBefore.after.top>=serviceExpanded.extra.height,`${name}: following content moves down by the additional services height`);
    assert.ok(serviceExpanded.links.every(link=>link.width>=44&&link.height>=44),`${name}: all services have finger-sized hit areas`);
    assert.equal(serviceExpanded.overflow,false);
    assert.deepEqual(serviceExpanded.links.map(link=>link.href),['/finance','/tasks','/trips','/meetings','/family-occasions','/majlis','/archive','/calendar','/chat','/community','/family-tree','/vault','/faith']);
    const accordion=await evaluate("(()=>{const button=document.querySelector('.oasis-services-toggle'),extra=document.getElementById(button.getAttribute('aria-controls'));return{exists:!!extra,hidden:extra.hidden,overflow:getComputedStyle(extra).overflowY}})()");
    assert.equal(accordion.exists,true); assert.equal(accordion.hidden,false); assert.equal(accordion.overflow,'visible');
    assert.ok(serviceExpanded.links.every(link=>link.bottom<=serviceExpanded.root.bottom),`${name}: every additional service stays inside the growing panel`);
    const expandedShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:Math.max(0,serviceExpanded.root.top-140),width,height:serviceExpanded.root.height+180,scale:1}});
    writeFileSync(`test-results/visitors/${name}-services-expanded.png`,Buffer.from(expandedShot.data,'base64'));
    await clickServiceToggle();
    const serviceCollapsed=await serviceLayout();
    assert.equal(serviceCollapsed.expanded,'false');assert.equal(serviceCollapsed.links.length,4);assert.equal(serviceCollapsed.extraHidden,true);
    assert.ok(Math.abs(serviceCollapsed.after.top-serviceBefore.after.top)<1,`${name}: collapsing restores the content below`);
    await evaluate("document.querySelector('.oasis-service-link').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    assert.equal(await evaluate("document.activeElement.getAttribute('href')"),'/tasks');
    assert.equal(await evaluate("document.activeElement.matches(':focus-visible')"),true);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    assert.equal(await evaluate("window.qaNavigations.at(-1)"),'/tasks');
    await evaluate("document.activeElement.blur();window.scrollTo(0,0)");await settle();
    console.log(`PASS ${name}: thirteen destinations, downward expansion below the stable trigger, following-content flow, keyboard and touch targets`);
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
      // The ornament must not move the existing desktop sculpture.
      if (width >= 970) {
        assert.ok(
          Math.abs(modelBefore.offsetLeft - modelBaseline.offsetLeft) < 1,
          `${name}: existing sculpture horizontal position retained ${JSON.stringify({ modelBefore, modelBaseline })}`,
        );
        assert.ok(
          Math.abs(modelBefore.offsetTop - modelBaseline.offsetTop) < 1,
          `${name}: existing sculpture vertical position retained ${JSON.stringify({ modelBefore, modelBaseline })}`,
        );
      }
      assert.ok(
        geometry.tower.right <= geometry.scene.right + 1 &&
          geometry.tower.left >= geometry.scene.left - 1,
        `${name}: sculpture stays inside the scene`,
      );
      assert.ok(
        geometry.parts.slice(1).every((part, index) => geometry.parts[index].left >= part.right - 1),
        `${name}: words and number do not overlap`,
      );
      assert.ok(geometry.contained, `${name}: count stays inside hero`);
      const decorationSpacing = await evaluate(
        `(()=>{const text=document.querySelector('.council-visitor-text').getBoundingClientRect();const ornaments=Array.from(document.querySelectorAll('.council-visitor-ornament')).map(n=>n.getBoundingClientRect());return {rightGap:ornaments[0].left-text.right,leftGap:text.left-ornaments[1].right}})()`,
      );
      assert.ok(
        decorationSpacing.rightGap >= 6 && decorationSpacing.leftGap >= 6,
        `${name}: both ornaments stay outside the text ${JSON.stringify(decorationSpacing)}`,
      );
      assert.equal(geometry.overflow, false, `${name}: no horizontal overflow`);
      assert.ok(
        geometry.label.includes("1,248"),
        `${name}: count is available to assistive technology`,
      );
    }
    await evaluate("window.qaSetName('حساب المعاينة');window.qaSetUnlocated(false)");
    const servicePeriodColors={};
    for (const [period, time] of [["day", "08:00:00"], ["night", "20:00:00"]]) {
      await evaluate(`window.qaSetClock('2026-10-16T${time}+03:00')`);
      await until(`document.querySelector('.council-oasis-scene').dataset.oasisPeriod==='${period}'`);
      await settle();
      const scene = await evaluate(`(()=>{const scene=document.querySelector('.council-oasis-scene');const active=scene.querySelector('.council-oasis-layer[data-period="${period}"]');const copy=scene.querySelector('.council-portal-copy').getBoundingClientRect();const counter=scene.querySelector('.council-visitor-counter').getBoundingClientRect();const tower=window.qaVisibleTower();return{source:scene.dataset.oasisClock,opacity:getComputedStyle(active).opacity,loaded:Array.from(document.images).every(img=>img.complete&&img.naturalWidth>0),name:scene.querySelector('strong').textContent,greeting:scene.querySelector('.council-portal-greeting').textContent,color:getComputedStyle(scene.querySelector('.council-portal-greeting')).color}})()`);
      assert.equal(scene.source, "solar"); assert.equal(scene.opacity, "1"); assert.equal(scene.loaded, true);
      const contrast = await evaluate(contrastCheck);
      assert.ok(contrast.every(ratio => ratio >= 4.5), `${name}/${period}: welcome and count remain readable against the scene sky ${JSON.stringify(contrast)}`);
      assert.ok(scene.greeting.includes(period === "day" ? "صباح الخير" : "مساء الخير"));
      const phasePalette=await servicePalette();servicePeriodColors[period]=phasePalette;
      const iconColors=new Set();
      for(const dark of [false,true]){
        await evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
        for(const identity of await evaluate('window.qaThemes')){
          await evaluate(`window.qaSetTheme(${JSON.stringify(identity)})`);await settle();
          const palette=await servicePalette();
          assert.deepEqual(palette.bg,phasePalette.bg,`${name}/${period}/${identity}: large services surface follows the scene independently of identity and application appearance`);
          assert.ok(palette.contrast[0]>=4.5&&palette.contrast[1]>=4.5&&palette.contrast[2]>=3,`${name}/${period}/${identity}: readable labels, descriptions and identity icons ${JSON.stringify(palette)}`);
          iconColors.add(JSON.stringify(palette.icon));
        }
      }
      assert.ok(iconColors.size>=6,`${name}/${period}: identity colors visibly reach service icons`);
      await evaluate("document.documentElement.classList.remove('dark');window.qaCustomRoles('royal-copper','emerald')");await settle();
      const customFirst=await servicePalette();
      await evaluate("window.qaCustomRoles('muted-palm','emerald')");await settle();
      const customIcons=await servicePalette();
      assert.notDeepEqual(customIcons.icon,customFirst.icon,'Custom icon role reaches services');
      assert.deepEqual(customIcons.line,customFirst.line,'Changing only icons preserves the independently selected accent role');
      await evaluate("window.qaCustomRoles('muted-palm','royal-copper')");await settle();
      const customAccent=await servicePalette();
      assert.notDeepEqual(customAccent.line,customIcons.line,'Custom accent role reaches fine dividers');
      assert.deepEqual(customAccent.icon,customIcons.icon,'Changing only accents preserves the icon role');
      assert.deepEqual(customAccent.bg,phasePalette.bg,'Custom backgrounds and text do not replace the approved oasis surface');
      await evaluate("window.qaSetTheme('emerald');window.scrollTo(0,0)");await settle();
      const previousColor = scene.color;
      await evaluate("document.documentElement.classList.add('dark')"); await settle();
      assert.equal(await evaluate("document.querySelector('.council-oasis-scene').dataset.oasisPeriod"), period, "Application dark mode does not override local daylight");
      assert.equal(await counterText(), "1,248");
      await evaluate("document.documentElement.classList.remove('dark')"); await settle();
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.council-portal-greeting')).color"), previousColor, "Light appearance restores the same daylight ink");
      const png = await send("Page.captureScreenshot", {format:"png",captureBeyondViewport:false});
      writeFileSync(`test-results/visitors/${name}-${period}.png`,Buffer.from(png.data,"base64"));
      const servicesBox=(await serviceLayout()).root;
      const serviceShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:Math.max(0,servicesBox.top-150),width,height:servicesBox.height+190,scale:1}});
      writeFileSync(`test-results/visitors/${name}-services-${period}.png`,Buffer.from(serviceShot.data,'base64'));

    }
    assert.notDeepEqual(servicePeriodColors.day.bg,servicePeriodColors.night.bg,`${name}: services switch their large surface with the oasis`);
    for (const [time, period] of [["05:40:59", "night"], ["05:41:00", "day"], ["17:11:59", "day"], ["17:12:00", "night"]]) {
      await evaluate(`window.qaSetClock('2026-10-16T${time}+03:00')`);
      await until(`document.querySelector('.council-oasis-scene').dataset.oasisPeriod==='${period}'`);
    }
    await evaluate("window.qaSetClock('2026-10-16T17:11:59.900+03:00')");
    await until("document.querySelector('.council-oasis-scene').dataset.oasisPeriod==='day'");
    // Let the real scheduled boundary update the scene without focus or a reload.
    await evaluate("window.qaNow=Date.parse('2026-10-16T17:12:00+03:00')");
    await until("document.querySelector('.council-oasis-scene').dataset.oasisPeriod==='night'");
    await evaluate("window.qaSetClock('2026-10-16T05:50:00+03:00')");
    await until("document.querySelector('.council-oasis-scene').dataset.oasisPeriod==='day'");
    await evaluate("window.qaSetUnlocated(true)");
    await until("document.querySelector('.council-oasis-scene').dataset.oasisClock==='clock' && document.querySelector('.council-oasis-scene').dataset.oasisPeriod==='night'");
    await evaluate("window.qaSetClock('2026-10-16T08:00:00+03:00')");
    await until("document.querySelector('.council-oasis-scene').dataset.oasisPeriod==='day'");
    const originalInk = await evaluate("getComputedStyle(document.querySelector('.council-visitor-number')).color");
    await evaluate("document.querySelector('.council-oasis-scene').style.setProperty('--identity-accent','#b97946')");
    await settle();
    assert.notEqual(await evaluate("getComputedStyle(document.querySelector('.council-visitor-number')).color"), originalInk, "Identity accents still apply with a daylight contrast adjustment");
    const finalTower = await evaluate("window.qaVisibleTower()");
    assert.equal(finalTower.portrait, width < 970, `${name}: correct landscape or portrait artwork without distortion`);
    console.log(`PASS ${name}: day/night images and joined services, six identities, custom roles, readable contrast, sunrise/sunset and no-GPS fallback`);
    } catch(error) {
      deviceFailures.push({name,error:String(error)});
      console.error(`FAIL ${name}:`,error.stack||error);
      try {
        const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        writeFileSync(`test-results/visitors/${name}-failure.png`,Buffer.from(png.data,'base64'));
      } catch { /* Preserve the original assertion if Chrome has already stopped. */ }
    }
  }
  assert.deepEqual(deviceFailures,[],"Every services/oasis viewport must pass");
  assert.deepEqual(errors, [], "No visitor/presence/React runtime exceptions");
  console.log("All actual visitor-counter Chrome checks passed");
} finally {
  websocket?.close();
  chrome.kill("SIGTERM");
  await new Promise((resolve) => server.close(resolve));
  rmSync(temporary, { recursive: true, force: true });
}
