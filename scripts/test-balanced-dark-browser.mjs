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

// Only CI's preinstalled Chrome runs the component browser checks. --prepare-only never starts a server/browser.
const prepareOnly = process.argv.includes("--prepare-only");
const chromePath =
  process.env.CHROME_PATH ||
  ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find(existsSync);
if (!chromePath && !prepareOnly)
  throw Error("Preinstalled Chrome is required for dark-mode checks");
const temporary = mkdtempSync(join(tmpdir(), "alsaif-dark-qa-"));
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
// Match Vite's local CSS imports (the approved curved dock is imported by theme-personalization).
const readStyles = (path) =>
  readFileSync(path, "utf8").replace(/@import\s+["']([^"']+\.css)["'];/g, (_, relative) =>
    readStyles(resolve(dirname(path), relative)),
  );
const css = [
  readFileSync(compiled[0], "utf8"),
  ...ordered.filter((p) => p !== "src/styles.css").map(readStyles),
].join("\n");
await build({
  entryPoints: ["scripts/fixtures/balanced-dark.tsx"],
  external: ["/family-tree-photo-v1.webp"],
  bundle: true,
  format: "iife",
  platform: "browser",
  outdir: output,
  entryNames: "fixture",
  assetNames: "[name]-[hash]",
  publicPath: "/__qa/",
  loader: { ".webp": "file", ".jpg": "file" },
  tsconfig: "tsconfig.json",
  plugins: [
    {
      name: "demo-router-and-prayer",
      setup(builder) {
        builder.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({
          path: "router",
          namespace: "qa",
        }));
        builder.onResolve({ filter: /^@\/hooks\/use-prayer-times$/ }, () => ({
          path: "prayer",
          namespace: "qa",
        }));
        builder.onLoad({ filter: /.*/, namespace: "qa" }, ({ path }) => ({
          loader: "jsx",
          resolveDir: process.cwd(),
          contents:
            path === "prayer"
              ? `export const usePrayerTimes=()=>({location:null,locationLabel:'حسب موقعك',prayer:null,countdown:'',loading:false});`
              : `import React from 'react';export function Link({to,search,children,...props}){return <a {...props} href={to}>{children}</a>}`,
        }));
      },
    },
  ],
});
// Color assertions inspect final states; transition behavior stays covered by the existing component checks.
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="theme-color" content="#0F5A3A"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}
html,body{margin:0}html *{transition-duration:0s!important;animation-duration:0s!important;animation-delay:0s!important}.qa-avatar{display:grid;place-items:center;width:42px;height:42px;background:var(--secondary);color:var(--foreground);border-radius:50%}.qa-card-grid{order:4;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:24px auto;min-width:0}.dashboard-page>.family-stats-strip{order:5}.qa-controls{display:grid;gap:18px;margin-top:28px}.qa-panel{padding:22px;display:grid;gap:14px}.qa-buttons{display:flex;gap:12px;flex-wrap:wrap}.qa-panel h2{font-size:22px;font-weight:800}.qa-panel p{font-size:14px}@media(max-width:599px){.qa-card-grid{grid-template-columns:minmax(0,1fr);padding-inline:16px}.qa-controls{padding:16px}}@media(min-width:1200px){.qa-card-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.qa-controls{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style><link rel="stylesheet" href="/__qa/fixture.css"></head><body><div id="app"></div><script src="/__qa/fixture.js"></script></body></html>`;
if (prepareOnly) {
  rmSync(temporary, { recursive: true, force: true });
  console.log("Balanced dark actual-component fixture compiled successfully");
  process.exit(0);
}
const server = createServer((request, response) => {
  if (request.url === "/logo-home.png") {
    response.setHeader("Content-Type", "image/png");
    response.end(readFileSync("public/logo-home.png"));
    return;
  }
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
          : path.endsWith(".jpg")
            ? "image/jpeg"
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
      "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,450))))",
    );
  const until = async (expression) => {
    for (let i = 0; i < 150; i++) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw Error(`Timed out: ${expression}`);
  };
  const key = async (value, keyCode) => {
    for (const type of ["keyDown", "keyUp"])
      await send("Input.dispatchKeyEvent", {
        type, key: value, code: value,
        windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
      });
  };
  const shot = async (name) => {
    const png = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    writeFileSync(`test-results/dark/${name}.png`, Buffer.from(png.data, "base64"));
  };
  await send("Page.enable");
  await send("Runtime.enable");
  mkdirSync("test-results/dark", { recursive: true });
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
    await send("Page.navigate", { url: `http://127.0.0.1:${port}/${tablet ? "?tablet=1" : ""}` });
    await until(
      "window.fixtureReady && document.querySelector('#qa-primary') && Array.from(document.images).every(i=>i.complete)",
    );
    await settle();
    await evaluate(
      `window.qaLuminance=c=>{const channels=c.match(/[\\d.]+/g).slice(0,3).map(n=>Number(n)/(c.startsWith("color(srgb")?1:255)).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return channels.reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0)};window.qaContrast=(a,b)=>(Math.max(qaLuminance(a),qaLuminance(b))+.05)/(Math.min(qaLuminance(a),qaLuminance(b))+.05);window.qaColors=s=>{const n=document.querySelector(s),c=getComputedStyle(n);return {bg:c.backgroundColor,fg:c.color}};window.qaGeometry=()=>Array.from(document.querySelectorAll('.followup-note,.ticket-surface,.trip-ticket--planning,.family-stats-strip')).map(n=>{const r=n.getBoundingClientRect();return [n.className,Math.round(r.width),Math.round(r.height)]})`,
    );
    await shot(`dark-home-${name}`);
    const geometry = await evaluate("qaGeometry()");
    for (const theme of await evaluate("window.qaThemes")) {
      await evaluate(`window.qaTheme(${JSON.stringify(theme)})`);
      await settle();
      const colors = await evaluate(
        `['body','.settings-panel','.meetings-ledger','.family-album','.chat-workspace','.followup-note','.trip-ticket--planning','.ticket-surface__paper','.legacy-heritage-hero'].map(s=>({selector:s,...qaColors(s)}))`,
      );
      for (const color of colors) {
        assert.ok(
          await evaluate(`qaLuminance(${JSON.stringify(color.bg)})<.09`),
          `${name}/${theme}: ${color.selector} keeps a dark surface`,
        );
        assert.ok(
          await evaluate(
            `qaContrast(${JSON.stringify(color.fg)},${JSON.stringify(color.bg)})>=4.5`,
          ),
          `${name}/${theme}: ${color.selector} has readable text`,
        );
      }
      for (const selector of ["#qa-settings-active", "#qa-admin-active"]) {
        const active = await evaluate(`qaColors(${JSON.stringify(selector)})`);
        assert.ok(
          await evaluate(
            `qaContrast(${JSON.stringify(active.fg)},${JSON.stringify(active.bg)})>=4.5`,
          ),
          `${name}/${theme}: selected navigation has readable text`,
        );
      }
      const primary = await evaluate("qaColors('#qa-primary')");
      assert.ok(
        await evaluate(
          `qaContrast(${JSON.stringify(primary.fg)},${JSON.stringify(primary.bg)})>=4.5`,
        ),
        `${name}/${theme}: accent button label contrast`,
      );
      assert.equal(
        await evaluate(
          "document.querySelector('.family-stats-strip').querySelectorAll('a,button,[tabindex]').length",
        ),
        0,
        "Statistics remain read-only",
      );
      assert.deepEqual(
        await evaluate("qaGeometry()"),
        geometry,
        `${name}/${theme}: color changes keep the approved component dimensions`,
      );
      const noOverflow = await evaluate("document.documentElement.scrollWidth<=innerWidth+2");
      if (!noOverflow)
        console.log(
          "OVERFLOW",
          await evaluate(
            "Array.from(document.querySelectorAll('body *')).map(n=>{const r=n.getBoundingClientRect();return {tag:n.tagName,cls:n.getAttribute('class'),left:r.left,right:r.right,width:r.width,position:getComputedStyle(n).position}}).filter(n=>n.left<-2||n.right>innerWidth+2).slice(-25)",
          ),
        );
      assert.equal(noOverflow, true, `${name}/${theme}: no horizontal overflow`);
    }
    await evaluate("window.qaCustom()");
    await settle();
    assert.equal(await evaluate("document.documentElement.dataset.themeColorMode"), "custom");
    assert.equal(
      await evaluate(
        "getComputedStyle(document.querySelector('.trip-ticket--planning')).color===getComputedStyle(document.body).color",
      ),
      true,
      "Custom text color reaches trip cards",
    );
    if (width >= 970) {
      // Reproduce green text/icons with an ivory button accent in the real portaled services menu.
      for (const appearance of ["light", "dark"]) {
        let savedInk;
        for (const accentId of ["family-ivory", "royal-copper"]) {
          const preference = {
            mode: "custom", baseId: "emerald", textId: "emerald", iconId: "muted-palm",
            backgroundId: "muted-palm", surfaceId: "emerald", navigationId: "emerald", accentId,
          };
          await evaluate(`window.qaPreference(${JSON.stringify(preference)},${appearance === "dark"});window.scrollTo(0,0)`);
          await settle();
          if (!(await evaluate("Boolean(document.querySelector('.family-seal-service-menu'))"))) {
            await evaluate("document.querySelector('.family-seal-header [aria-label=\"فتح قائمة الخدمات\"]').focus()");
            await key("Enter", 13);
            await until("document.querySelector('.family-seal-service-item small')");
            await settle();
          }
          const colors = await evaluate(`(() => {
            const menu=document.querySelector('.family-seal-service-menu');
            const item=menu.querySelector('.family-seal-service-item');
            const resolve=token=>{const n=document.createElement('span');n.style.color='var('+token+')';document.body.append(n);const c=getComputedStyle(n).color;n.remove();return c;};
            const heading=getComputedStyle(menu.querySelector('.family-seal-service-heading')).color;
            const label=getComputedStyle(item.querySelector('span')).color;
            const icon=getComputedStyle(item.querySelector('svg')).color;
            const description=getComputedStyle(item.querySelector('small')).color;
            const bg=getComputedStyle(menu).backgroundColor;
            return {heading,label,icon,description,textToken:resolve('--identity-text'),iconToken:resolve('--identity-icon'),mutedToken:resolve('--muted-foreground'),portal:!menu.closest('.family-seal-header'),textContrast:qaContrast(label,bg),iconContrast:qaContrast(icon,bg),descriptionContrast:qaContrast(description,bg)};
          })()`);
          assert.equal(colors.portal, true, "Services menu is tested outside the header");
          assert.equal(colors.heading, colors.textToken, `${name}/${appearance}: menu heading follows text color`);
          assert.equal(colors.label, colors.textToken, `${name}/${appearance}: service labels follow text color`);
          assert.equal(colors.icon, colors.iconToken, `${name}/${appearance}: service icons follow icon color`);
          assert.equal(colors.description, colors.mutedToken, `${name}/${appearance}: descriptions use readable secondary text`);
          assert.ok(colors.textContrast >= 4.5 && colors.descriptionContrast >= 4.5, "Green menu text remains readable with an ivory button accent");
          assert.ok(colors.iconContrast >= 3, "Selected green icons remain visible");
          const ink = { heading: colors.heading, label: colors.label, icon: colors.icon, description: colors.description };
          if (savedInk) assert.deepEqual(ink, savedInk, "Changing button accents does not recolor menu text or icons");
          savedInk = ink;
          if (accentId === "family-ivory") await shot(`services-menu-${appearance}-${name}`);
        }
        await key("Escape", 27);
        await until("!document.querySelector('.family-seal-service-menu')");
      }
      console.log(`PASS ${name}: portaled services menu respects independent green text/icons with ivory and copper button accents`);
    }
    await evaluate("window.qaLight()");
    await settle();
    assert.ok(
      await evaluate("qaLuminance(qaColors('body').bg)>.8"),
      "Returning to light mode clears dark overrides",
    );
    // Capture the approved neutral services colours using the same responsive fixture.
    for (const identity of ["emerald", "muted-palm"]) {
      await evaluate(
        `window.qaTheme(${JSON.stringify(identity)});document.querySelector('.family-services-section,.desktop-services-panel').scrollIntoView({block:'center'})`,
      );
      await settle();
      await shot(`light-services-${identity}-${name}`);
    }
    await evaluate("window.qaTheme('royal-copper');window.scrollTo(0,0)");
    await settle();
    await shot(`light-faith-gap-copper-${name}`);
    await evaluate(
      "window.qaDark();document.querySelector('.family-stats-strip').scrollIntoView({block:'start'})",
    );
    await settle();
    await shot(`dark-cards-${name}`);
    await evaluate("document.querySelector('#qa-open-dialog').click()");
    await until("document.querySelector('[role=dialog]')");
    await settle();
    const dialog = await evaluate("qaColors('[role=dialog]')");
    assert.ok(
      await evaluate(
        `qaLuminance(${JSON.stringify(dialog.bg)})<.09 && qaContrast(${JSON.stringify(dialog.fg)},${JSON.stringify(dialog.bg)})>=4.5`,
      ),
      `${name}: portal dialog keeps the raised dark palette`,
    );
    await shot(`dark-dialog-${name}`);
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    });
    await until("!document.querySelector('[role=dialog]')");
    await evaluate("document.querySelector('#qa-select').focus()");
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "ArrowDown",
      code: "ArrowDown",
      windowsVirtualKeyCode: 40,
      nativeVirtualKeyCode: 40,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "ArrowDown",
      code: "ArrowDown",
      windowsVirtualKeyCode: 40,
      nativeVirtualKeyCode: 40,
    });
    await until("document.querySelector('[role=listbox]')");
    await settle();
    const listbox = await evaluate("qaColors('[role=listbox]')");
    assert.ok(
      await evaluate(
        `qaLuminance(${JSON.stringify(listbox.bg)})<.09 && qaContrast(${JSON.stringify(listbox.fg)},${JSON.stringify(listbox.bg)})>=4.5`,
      ),
      `${name}: select portal follows dark mode`,
    );
    await shot(`dark-select-${name}`);
    if (["phone", "ipad-landscape"].includes(name)) {
      await evaluate(
        "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))",
      );
      await until("!document.querySelector('[role=listbox]')");
      const roles = [
        ["textId", "--foreground", ".theme-customizer-preview-card b", "color"],
        ["iconId", "--identity-icon", ".theme-customizer-preview-icon", "backgroundColor"],
        ["backgroundId", "--background", ".theme-customizer-preview", "backgroundColor"],
        ["surfaceId", "--card", ".theme-customizer-preview-card", "backgroundColor"],
        ["navigationId", "--nav-bg", ".theme-customizer-preview-nav", "backgroundColor"],
        ["accentId", "--primary", ".theme-customizer-preview-body > button", "backgroundColor"],
      ];
      for (const appearance of ["light", "dark"]) {
        await evaluate(
          `window.${appearance === "light" ? "qaLight" : "qaDark"}();document.querySelector('#qa-open-theme').click()`,
        );
        await until("document.querySelector('.theme-customizer-role-list')");
        for (const [role, property, preview, channel] of roles) {
          const ivory = `[data-theme-role="${role}"] [data-color-id="family-ivory"]`;
          assert.equal(
            await evaluate(
              `getComputedStyle(document.querySelector(${JSON.stringify(ivory + " i")})).backgroundColor`,
            ),
            "rgb(245, 241, 232)",
            `${name}/${appearance}/${role}: ivory circle uses the actual services color`,
          );
          await evaluate(`document.querySelector(${JSON.stringify(ivory)}).click()`);
          await settle();
          assert.equal(
            await evaluate(
              `document.documentElement.style.getPropertyValue(${JSON.stringify(property)})`,
            ),
            "#F5F1E8",
            `${role}: choosing ivory applies that exact color`,
          );
          assert.equal(
            await evaluate(
              `getComputedStyle(document.querySelector(${JSON.stringify(preview)}))[${JSON.stringify(channel)}]`,
            ),
            "rgb(245, 241, 232)",
            `${role}: preview matches the chosen circle`,
          );
          assert.ok(
            await evaluate(
              "qaContrast(getComputedStyle(document.querySelector('#theme-customizer-title')).color,qaColors('.theme-customizer-dialog').bg)>=4.5",
            ),
            "Editing controls remain readable while previewing ivory text",
          );
          await evaluate(
            `document.querySelector('[data-theme-role="${role}"] [data-color-id="emerald"]').click()`,
          );
          await settle();
        }
        await evaluate(
          "document.querySelector('[data-theme-role=backgroundId] [data-color-id=family-ivory]').click()",
        );
        await settle();
        await shot(`customizer-ivory-${appearance}-${name}`);
        await evaluate("document.querySelector('.theme-customizer-save').click()");
        await until("!document.querySelector('.theme-customizer-dialog')");
        assert.equal(
          await evaluate("JSON.parse(window.qaSavedTheme.slice('custom:'.length)).background"),
          "family-ivory",
          "Saving persists the exact ivory choice",
        );
        await evaluate("document.querySelector('#qa-open-theme').click()");
        await until(
          "document.querySelector('[data-theme-role=backgroundId] [data-color-id=family-ivory][aria-pressed=true]')",
        );
        await evaluate(
          "document.querySelector('[data-theme-role=iconId] [data-color-id=family-ivory]').click()",
        );
        await settle();
        await evaluate(
          "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))",
        );
        await until("!document.querySelector('.theme-customizer-dialog')");
        assert.equal(
          await evaluate("document.documentElement.style.getPropertyValue('--background')"),
          "#F5F1E8",
          "Cancelling retains saved ivory background",
        );
        assert.notEqual(
          await evaluate("document.documentElement.style.getPropertyValue('--identity-icon')"),
          "#F5F1E8",
          "Cancelling removes the unsaved ivory icon choice",
        );
      }
    }
    console.log(
      `PASS ${name}: identities, custom roles, dark cards and portals, read-only stats, preserved geometry, light restoration and no overflow`,
    );
  }
  assert.deepEqual(errors, [], "No component runtime errors");
  console.log("All balanced dark Chrome checks passed");
} finally {
  websocket?.close();
  chrome.kill("SIGTERM");
  await new Promise((resolve) => server.close(resolve));
  rmSync(temporary, { recursive: true, force: true });
}
