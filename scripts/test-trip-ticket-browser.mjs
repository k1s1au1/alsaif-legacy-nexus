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
import {FollowupNoteCard} from './src/components/dashboard/followup-note-card';
import photo from './src/assets/trip-alula.jpg';
window.edits=0;window.deletes=0;
const trip={title:'رحلة العلا',status:'upcoming',location:'العلا',badge:null,description:'استكشاف المعالم الطبيعية والتراثية مع العائلة.',start_date:'2026-10-21',end_date:'2026-10-23'};
const image=<img src={photo} alt="العلا"/>;
const details=<a href="#details">عرض التفاصيل <ChevronLeft size={18}/></a>;
const actions=<><button type="button" onClick={()=>window.edits++}><Pencil size={18}/>تعديل</button><button type="button" className="trip-ticket__delete" onClick={()=>window.deletes++}><Trash2 size={18}/>حذف</button></>;
function Fixture(){return <main><h1>قالب التذاكر الموحّد</h1><p>معاينة المكونات الفعلية ببيانات تجريبية</p>
<section className="qa-home dashboard-page integrated-hub"><h2>الرئيسية</h2><UpcomingTripTicket trip={trip} image={image} details={details} compact/></section>
<section className="trips-page"><h2>قائمة الرحلات</h2><div className="trips-ticket-grid trips-ticket-grid--upcoming"><TripTicket trip={trip} image={image} details={details} statusControl={<span>قادمة</span>} actions={actions}/><TripTicket trip={{...trip,title:'عرض العضو',description:null}} image={image} details={details} statusControl={<span>قادمة</span>}/></div>
<h2>قيد التخطيط — الورقة المطوية</h2><TripTicket trip={{...trip,status:'planning'}} image={image} details={<a className="trip-ticket__details" href="#planning">شارك في التخطيط</a>} statusControl={<span>قيد التخطيط</span>} actions={actions}/></section></main>}
function FollowupFixture(){const [long,setLong]=React.useState(false);const [missing,setMissing]=React.useState(false);window.qaLong=setLong;window.qaMissing=setMissing;window.meetingOpens=0;
const meeting=<FollowupNoteCard kind="meeting" title={long?'اجتماع مجلس العائلة لمراجعة المشاريع القادمة وتنظيم اللقاء السنوي لجميع أفراد العائلة':'اجتماع تدشين موقع السيف'} date={missing?'invalid':'2026-12-30T11:50:00+03:00'} location={long?'قاعة الاجتماعات الرئيسية في مخيمات العائلة بالمنطقة الشرقية':'مخيمات سابك'} action={<button type="button" onClick={()=>window.meetingOpens++}>فتح الاجتماع <ChevronLeft size={16}/></button>}/>;
const task=<FollowupNoteCard kind="task" title={long?'إنشاء شجرة العائلة وتوثيق صلة القرابة لجميع أفراد العائلة ومراجعة المعلومات':'إنشاء شجرة العائلة'} date={missing?null:'2026-12-30'} action={<a href="/tasks">فتح المهمة <ChevronLeft size={16}/></a>}/>;
return <main className="qa-followup-preview"><h1>الاجتماعات والمهام</h1><p>معاينة القالب الموحّد ببيانات تجريبية</p>{innerWidth<970?<div className="dashboard-page"><section className="integrated-hub"><div className="hub-mobile-slider"><div className="hub-expanded-list">{meeting}{task}</div></div></section></div>:<div className="desktop-follow-cards">{meeting}{task}</div>}</main>}
function PlanningFixture(){const [mode,setMode]=React.useState('home');const [long,setLong]=React.useState(false);const [missing,setMissing]=React.useState(false);window.qaMode=setMode;window.qaLong=setLong;window.qaMissing=setMissing;
const sample={...trip,title:long?'رحلة العائلة لاستكشاف المعالم الطبيعية والتراثية في العلا':'العلا',location:long?'محافظة العلا والمواقع التراثية المحيطة بها':'العلا',badge:mode==='home'?null:'وسمية',description:null,start_date:missing?'invalid':'2026-10-21',end_date:missing?null:'2026-10-23'};
const card=status=><TripTicket trip={{...sample,status}} compact={mode==='home'} image={image} details={<a href={status==='planning'?'/trips/demo-planning':'/trips/demo-upcoming'}>التفاصيل <ChevronLeft size={16}/></a>} statusControl={mode==='home'?undefined:<div className="trip-status-control"><div className="trip-status-control__field"><select aria-label="حالة الرحلة" defaultValue={status} onChange={()=>window.statusChanges=(window.statusChanges||0)+1}><option value="planning">قيد التخطيط</option><option value="upcoming">قادمة</option></select></div></div>} actions={mode==='list'?actions:undefined}/>;
return <main className="qa-planning-preview"><h1>بطاقات الرحلات</h1><p>معاينة التنفيذ ببيانات تجريبية — {mode==='home'?'المتابعة السريعة':'قائمة الرحلات'}</p>{mode==='home'?(innerWidth<970?<div className="dashboard-page"><section className="integrated-hub"><div className="hub-mobile-slider"><div className="hub-expanded-list"><div className="hub-carousel-item">{card('planning')}</div><div className="hub-carousel-item">{card('upcoming')}</div></div></div></section></div>:<div className="desktop-follow-cards">{card('planning')}{card('upcoming')}</div>):<section className="trips-page"><div className="trips-ticket-grid">{card('planning')}{card('upcoming')}</div></section>}</main>}
createRoot(document.getElementById('app')).render(location.pathname==='/planning'?<PlanningFixture/>:location.pathname==='/followup'?<FollowupFixture/>:<Fixture/>);window.fixtureReady=true;`;
await build({ stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: "ticket-qa.tsx", loader: "tsx" }, bundle: true, format: "iife", platform: "browser", outdir: output, entryNames: "fixture", assetNames: "[name]-[hash]", publicPath: "/__qa/", loader: { ".jpg": "file" }, tsconfig: "tsconfig.json" });
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
html,body{margin:0}body{background:var(--background);color:var(--foreground)}main{max-width:1240px;margin:auto;padding:24px;min-width:0}main>h1{font-size:30px;font-weight:900}main>p{margin:8px 0 24px}h2{margin:20px 0 16px;font-size:22px;font-weight:800}.qa-home{max-width:900px;margin:0 auto 28px;padding:20px;border-radius:24px;background:repeating-linear-gradient(45deg,var(--background) 0 12px,var(--muted) 12px 24px)}.trips-page{padding:0 0 24px}.qa-home .upcoming-trip-ticket{width:100%}.qa-followup-preview{max-width:960px}.qa-followup-preview .desktop-follow-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.qa-followup-preview .hub-expanded-list{display:grid;gap:20px;padding:12px!important}.qa-followup-preview .integrated-hub{background:var(--background)!important}.qa-planning-preview{max-width:1240px}.qa-planning-preview>h1,.qa-planning-preview>p{color:var(--primary)}.qa-planning-preview .hub-expanded-list{display:grid;gap:20px;padding:0!important}.qa-planning-preview .integrated-hub{padding:0!important;background:transparent!important}.qa-planning-preview .hub-carousel-item{min-width:0;padding:0!important}.qa-planning-preview .dashboard-page{background:transparent!important}@media(max-width:599px){.qa-planning-preview{padding:16px}.qa-planning-preview>h1{font-size:25px}.qa-planning-preview>p{font-size:13px}} </style><link rel="stylesheet" href="/__qa/fixture.css"></head><body><div id="app"></div><script src="/__qa/fixture.js"></script></body></html>`;
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
        return {validClip:CSS.supports('clip-path',paper.style.clipPath),transparent:getComputedStyle(ticket).backgroundColor==='rgba(0, 0, 0, 0)',leftCut:!inside(b.left+3,y),rightCut:!inside(b.right-3,y),inner:inside(b.left+24,y),radius:ticket.querySelector('.ticket-surface__outline > path').getAttribute('d').includes('A 14 14'),paperWidth:paper.offsetWidth,outlineWidth:Number(ticket.querySelector('svg.ticket-surface__outline').getAttribute('width'))};
      })`);
      assert.equal(cuts.length,3);
      for (const cut of cuts) { for (const key of ['validClip','transparent','leftCut','rightCut','inner','radius']) assert.equal(cut[key],true,`${name}/${dark?'dark':'light'}: ${key}`);assert.equal(cut.paperWidth,cut.outlineWidth); }
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+2"),true,`${name}: no horizontal overflow`);
    }
    await evaluate("document.documentElement.classList.remove('dark');scrollTo(0,0)");await settle();
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.upcoming-trip-ticket__actions button')).every(b=>b.getBoundingClientRect().height>=44 && getComputedStyle(b).visibility==='visible')"),true,`${name}: touch actions visible`);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.upcoming-trip-ticket__actions .trip-ticket__delete')).color"),"rgb(198, 40, 40)",`${name}: deletion keeps its red cue`);
    await evaluate("document.querySelector('.upcoming-trip-ticket__actions button').click();document.querySelector('.upcoming-trip-ticket__actions .trip-ticket__delete').click()");
    assert.equal(await evaluate("window.edits===1 && window.deletes===1"),true,`${name}: original action callbacks work`);
    assert.equal(await evaluate("document.querySelectorAll('.upcoming-trip-ticket')[2].querySelector('.upcoming-trip-ticket__actions')"),null,`${name}: member has no management actions`);
    assert.equal(await evaluate("!!document.querySelector('.trip-ticket--planning .trip-ticket__fold') && !document.querySelector('.trip-ticket--planning .ticket-surface__outline')"),true,`${name}: planning keeps its separate template`);
    const layout = await send("Page.getLayoutMetrics");
    const png = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.ceil(layout.cssContentSize.height), scale: 1 } });
    writeFileSync(`test-results/trip-tickets/${name}.png`, Buffer.from(png.data,"base64"));
    console.log(`PASS ${name}: real transparent 14px cuts, aligned border, dark/light, touch actions, member visibility and planning exception`);
  }
  await send("Emulation.setTimezoneOverride", { timezoneId: "Asia/Riyadh" });
  for (const [name,width,height] of [["small-phone",320,900],["phone",390,960],["ipad-portrait",834,1194],["ipad-landscape",1024,768],["ipad-pro-landscape",1366,1024],["desktop",1440,1000]]) {
    await send("Emulation.setDeviceMetricsOverride", { width,height,deviceScaleFactor:1,mobile:false });
    await send("Page.navigate", { url:`http://127.0.0.1:${port}/followup` });
    await until("window.fixtureReady && document.querySelectorAll('.followup-note').length===2");await settle();
    assert.match(await evaluate("document.querySelector('.followup-note__calendar').textContent"),/٣٠.*ديسمبر/,`${name}: date tile uses the same Gregorian date as the metadata`);
    await evaluate("document.querySelector('.followup-note__action button').click()");
    assert.equal(await evaluate("window.meetingOpens"),1,`${name}: meeting keeps its original open callback`);
    assert.equal(await evaluate("document.querySelector('.followup-note__action a').getAttribute('href')"),"/tasks",`${name}: task navigation retained`);
    for (const long of [false,true]) {
      await evaluate(`window.qaLong(${long})`);await settle();
      const cards=await evaluate(`Array.from(document.querySelectorAll('.followup-note')).map(card=>{
        const box=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}};
        const r=box(card),title=box(card.querySelector('h3')),meta=box(card.querySelector('.followup-note__meta')),action=box(card.querySelector('.followup-note__action > *')),motif=box(card.querySelector('.followup-note__calendar,.followup-note__checklist'));
        return{r,title,meta,action,motif,overflow:card.scrollWidth>card.clientWidth+1};})`);
      for(const card of cards){
        assert.equal(card.overflow,false,`${name}: card has no horizontal clipping`);
        assert.ok(card.r.left>=-1 && card.r.right<=width+1,`${name}: complete card stays inside the viewport`);
        assert.ok(card.title.bottom<=card.meta.top+1 && card.meta.bottom<=card.action.top+1,`${name}/${long}: title, metadata and action do not overlap ${JSON.stringify(card)}`);
        assert.ok(card.action.height>=44 && card.action.bottom<=card.r.bottom-8,`${name}: action remains an accessible touch target`);
        assert.ok(card.motif.right+8<=card.title.left && card.motif.right+8<=card.meta.left,`${name}: decoration stays clear of content`);
      }
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+2"),true,`${name}: page stays within viewport`);
      if(!long){
        const png=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
        writeFileSync(`test-results/trip-tickets/followup-${name}.png`,Buffer.from(png.data,"base64"));
      }
    }
    await evaluate("window.qaMissing(true)");await settle();
    assert.equal(await evaluate("document.querySelectorAll('.followup-note__meta')[1].textContent.includes('بدون موعد')"),true,`${name}: missing date stays readable`);
    assert.equal(await evaluate("document.querySelector('.followup-note__calendar strong').textContent"),"—",`${name}: invalid date never displays NaN`);
    const original=await evaluate("getComputedStyle(document.querySelector('.followup-note--meeting')).backgroundImage");
    await evaluate("document.documentElement.classList.add('dark');document.documentElement.style.setProperty('--identity-header','#4c244a');document.documentElement.style.setProperty('--identity-accent','#d5a776');document.documentElement.style.setProperty('--identity-text-on-nav','#fff2e4');document.documentElement.style.setProperty('--identity-icon-on-nav','#e8be8e')");await settle();
    assert.notEqual(await evaluate("getComputedStyle(document.querySelector('.followup-note--meeting')).backgroundImage"),original,`${name}: shared cards follow the chosen identity`);
    await evaluate("document.documentElement.style.setProperty('--identity-soft','#211923');document.documentElement.style.setProperty('--identity-text','#f5ebdf')");
    await until("getComputedStyle(document.querySelector('.followup-note__calendar')).color==='rgb(245, 235, 223)'");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.followup-note__calendar')).color"),"rgb(245, 235, 223)",`${name}: date tile retains readable identity text in dark mode`);
    await send("Input.dispatchKeyEvent", { type:"keyDown",key:"Tab",code:"Tab",windowsVirtualKeyCode:9,nativeVirtualKeyCode:9 });
    await send("Input.dispatchKeyEvent", { type:"keyUp",key:"Tab",code:"Tab",windowsVirtualKeyCode:9,nativeVirtualKeyCode:9 });
    await evaluate("document.querySelector('.followup-note__action button').focus()");
    await until("getComputedStyle(document.querySelector('.followup-note__action button')).outlineStyle==='solid'");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.followup-note__action button')).outlineStyle"),"solid",`${name}: keyboard focus is visible`);
    console.log(`PASS ${name}: shared meeting/task design, real dates, wrapped titles, touch actions, identity and keyboard focus`);
  }
  for(const [name,width,height] of [["small-phone",320,1000],["phone",390,1000],["ipad-portrait",834,1194],["ipad-landscape",1024,768],["ipad-pro-landscape",1366,1024],["desktop",1440,1000]]){
    await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
    await send("Emulation.setTouchEmulationEnabled",{enabled:width<1400,maxTouchPoints:5});
    await send("Page.navigate",{url:`http://127.0.0.1:${port}/planning`});
    await until("window.fixtureReady && document.querySelector('.trip-ticket--planning') && Array.from(document.images).every(i=>i.complete && i.naturalWidth>0)");await settle();
    for(const mode of ['home','list']){
      await evaluate(`window.qaMode('${mode}');scrollTo(0,0)`);await settle();
      const dimensions=await evaluate(`Array.from(document.querySelectorAll('[data-trip-status]')).map(card=>{const r=card.getBoundingClientRect(),photo=card.querySelector('.trip-ticket__photo,.upcoming-trip-ticket__photo').getBoundingClientRect();return{status:card.dataset.tripStatus,width:r.width,height:r.height,photoHeight:photo.height,left:r.left,right:r.right}})`);
      assert.equal(dimensions.length,2);
      assert.ok(Math.abs(dimensions[0].width-dimensions[1].width)<2,`${name}/${mode}: planning and upcoming share the same card width ${JSON.stringify(dimensions)}`);
      if(mode==='home'){
        assert.ok(Math.abs(dimensions[0].photoHeight-dimensions[1].photoHeight)<1,`${name}: same compact image height`);
        assert.ok(Math.abs(dimensions[0].height-dimensions[1].height)<=32,`${name}: comparable compact footprint ${JSON.stringify(dimensions)}`);
      }else{
        assert.ok(Math.abs(dimensions[0].height-dimensions[1].height)<=65,`${name}: comparable list footprint ${JSON.stringify(dimensions)}`);
      }
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+2"),true,`${name}/${mode}: no horizontal overflow`);
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.trip-ticket--planning')).borderTopStyle"),'dashed',`${name}: planning retains the reference's dashed paper`);
      assert.equal(await evaluate("document.querySelector('.trip-ticket__detail-link a').getAttribute('href')"),'/trips/demo-planning',`${name}: planning opens the original trip detail route`);
      assert.match(await evaluate("document.querySelector('.trip-ticket__proposed-date').textContent"),/الموعد المقترح.*أكتوبر/,`${name}: proposed dates remain distinct from confirmed dates`);
      const png=await send("Page.captureScreenshot",{format:'png',captureBeyondViewport:false});
      writeFileSync(`test-results/trip-tickets/planning-${mode}-${name}.png`,Buffer.from(png.data,'base64'));
      console.log(`PASS planning ${name}/${mode}: ${JSON.stringify(dimensions)}`);
    }
    await evaluate("document.querySelector('.trip-ticket__actions button').click();document.querySelector('.trip-ticket__delete').click();const select=document.querySelector('.trip-ticket__status select');select.value='upcoming';select.dispatchEvent(new Event('change',{bubbles:true}))");
    assert.equal(await evaluate("window.edits===1 && window.deletes===1 && window.statusChanges===1"),true,`${name}: original management callbacks and status control preserved`);
    assert.equal(await evaluate("Array.from(document.querySelectorAll('.trip-ticket__actions button,.trip-ticket__status select')).every(el=>el.getBoundingClientRect().height>=44 && getComputedStyle(el).visibility==='visible')"),true,`${name}: management actions visible on touch screens`);
    await evaluate("window.qaMode('member')");await settle();
    assert.equal(await evaluate("document.querySelector('.trip-ticket__actions')"),null,`${name}: actions stay permission-controlled`);
    for(const mode of ['home','list']){
      await evaluate(`window.qaMode('${mode}');window.qaLong(true)`);await settle();
      assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth+2"),true,`${name}/${mode}: long Arabic titles do not overflow`);
      assert.equal(await evaluate(`(()=>{const card=document.querySelector('.trip-ticket--planning');const nodes=['.trip-ticket__copy','.trip-ticket__links','.trip-ticket__photo'].map(sel=>card.querySelector(sel).getBoundingClientRect());const overlaps=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1;return !overlaps(nodes[0],nodes[1])&&!overlaps(nodes[0],nodes[2])&&!overlaps(nodes[1],nodes[2])})()`),true,`${name}/${mode}: text, date and photo do not overlap`);
    }
    await evaluate("window.qaMissing(true);document.documentElement.classList.add('dark');document.documentElement.dataset.themeColorMode='custom';document.documentElement.style.setProperty('--identity-text','#f5ebdf')");
    await until("getComputedStyle(document.querySelector('.trip-ticket--planning')).color==='rgb(245, 235, 223)'");
    assert.match(await evaluate("document.querySelector('.trip-ticket__proposed-date').textContent"),/لم يحدد بعد/,`${name}: unknown date stays truthful`);
    await send("Input.dispatchKeyEvent",{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
    await send("Input.dispatchKeyEvent",{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
    await evaluate("document.querySelector('.trip-ticket__detail-link a').focus()");
    await until("getComputedStyle(document.querySelector('.trip-ticket__detail-link a')).outlineStyle==='solid'");
    console.log(`PASS planning ${name}: long titles, missing dates, identity colors, touch actions and keyboard focus`);
  }
  assert.deepEqual(errors,[],"No React or ResizeObserver runtime errors");
  console.log("All actual ticket Chrome component checks passed");
} finally {
  websocket?.close();chrome.kill("SIGTERM");await new Promise(resolve=>server.close(resolve));rmSync(temporary,{recursive:true,force:true});
}
