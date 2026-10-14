import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { buildSync } from "esbuild";

const prayer = await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(readFileSync("src/lib/prayer-times.ts", "utf8"))).toString("base64"));
const compiled = buildSync({ entryPoints: ["src/lib/mushaf.ts"], bundle: true, platform: "node", format: "esm", write: false, tsconfig: "tsconfig.json" }).outputFiles[0].text;
const mushaf = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const locationModule = buildSync({ entryPoints: ["src/lib/prayer-location.ts"], bundle: true, platform: "node", format: "esm", write: false }).outputFiles[0].text;
const gps = await import("data:text/javascript;base64," + Buffer.from(locationModule).toString("base64"));
const jubail = { latitude: 27.010, longitude: 49.660, accuracy: 25, obtainedAt: Date.now() - 1000 };
const riyadh = { ...jubail, latitude: 24.714, longitude: 46.675 };
const memoryStorage = (value) => { const map = new Map(value ? [[gps.PRAYER_LOCATION_KEY, JSON.stringify(value)]] : []); return { getItem: key => map.get(key) || null, setItem: (key, item) => map.set(key, item), removeItem: key => map.delete(key) }; };
const index = JSON.parse(readFileSync("src/data/mushaf-index.json", "utf8"));
const day = (date) => ({ date, timings: Object.fromEntries([['Fajr', '05:00'], ['Dhuhr', '12:00'], ['Asr', '15:15'], ['Maghrib', '18:00'], ['Isha', '19:30']].map(([key, value]) => [key, `${date}T${value}:00+03:00`])) });

test("After Isha, the next prayer is the following day's Fajr across the year boundary", () => {
  const found = prayer.nextPrayer([day("2026-12-31"), day("2027-01-01")], new Date("2026-12-31T23:40:00+03:00"));
  assert.equal(found.key, "Fajr"); assert.equal(found.date, "2027-01-01");
});
test("Use Saudi dates even when the device timezone is different", () => {
  assert.deepEqual(prayer.saudiDateParts(new Date("2026-10-31T22:30:00Z")), { year: 2026, month: 11, date: "2026-11-01" });
});
test("A prayer exactly at its time is not skipped and countdown is never negative", () => {
  const now = new Date("2026-10-13T18:00:00+03:00");
  assert.equal(prayer.nextPrayer([day("2026-10-13")], now).key, "Maghrib");
  assert.equal(prayer.prayerCountdown(now, now), "حان وقت الصلاة");
  assert.equal(prayer.nextPrayer([day("2026-10-13")], new Date("2026-10-13T20:00:00+03:00")), null);
});
test("Coordinates replace the city endpoint without a default city", () => {
  const url = new URL(prayer.prayerCalendarUrl(jubail, 2026, 10));
  assert.equal(url.pathname, "/v1/calendar/2026/10");
  assert.equal(url.searchParams.get("latitude"), "27.010"); assert.equal(url.searchParams.get("longitude"), "49.660");
  assert.equal(url.searchParams.get("method"), "4"); assert.equal(url.searchParams.has("city"), false);
});
const makeCalendar = (location = jubail) => ({ code: 200, data: Array.from({ length: 31 }, (_, i) => ({ timings: day(`2026-10-${String(i + 1).padStart(2, "0")}`).timings, date: { gregorian: { date: `${String(i + 1).padStart(2, "0")}-10-2026` } }, meta: { latitude: location.latitude, longitude: location.longitude, method: { id: 4 }, timezone: "Asia/Riyadh" } })) });
test("Calendars cannot silently switch coordinates, method, date, or timezone", () => {
  assert.equal(prayer.normalizePrayerCalendar(makeCalendar(), jubail, 2026, 10).days.length, 31);
  for (const change of [x => x.meta.method.id = 3, x => x.meta.timezone = "Europe/London", x => x.meta.latitude = 24.714, x => x.meta.longitude = undefined, x => x.date.gregorian.date = "01-11-2026", x => x.timings.Fajr = "05:00"]) {
    const payload = makeCalendar(); change(payload.data[0]); assert.throws(() => prayer.normalizePrayerCalendar(payload, jubail, 2026, 10));
  }
});
test("Cache is scoped to GPS coordinates and month, including tampered entries", () => {
  const store = new Map(); globalThis.localStorage = { getItem: key => store.get(key) || null };
  const calendar = prayer.normalizePrayerCalendar(makeCalendar(), jubail, 2026, 10);
  store.set(prayer.prayerCacheKey(jubail, 2026, 10), JSON.stringify(calendar));
  assert.equal(prayer.readPrayerCalendar(jubail, 2026, 10).days.length, 31);
  assert.equal(prayer.readPrayerCalendar(riyadh, 2026, 10), undefined);
  assert.equal(prayer.readPrayerCalendar(jubail, 2026, 11), undefined);
  store.set(prayer.prayerCacheKey(riyadh, 2026, 10), JSON.stringify(calendar));
  assert.equal(prayer.readPrayerCalendar(riyadh, 2026, 10), undefined);
  delete globalThis.localStorage;
});
test("Location dates and tomorrow follow the resolved timezone across DST and year changes", () => {
  const now = new Date("2026-10-31T22:30:00Z");
  assert.equal(prayer.prayerDateParts(now, "Asia/Riyadh").date, "2026-11-01");
  assert.equal(prayer.prayerDateParts(now, "America/Los_Angeles").date, "2026-10-31");
  assert.deepEqual(prayer.nextPrayerDate("2026-12-31"), {year:2027,month:1,date:"2027-01-01"});
  assert.equal(prayer.nextPrayerDate("2026-11-01").date, "2026-11-02");
});
test("Malformed positions cannot trigger requests, and full precision is not stored", () => {
  assert.equal(prayer.normalizePrayerLocation({...jubail, latitude:NaN}), undefined);
  assert.equal(prayer.normalizePrayerLocation({...jubail, longitude:181}), undefined);
  assert.equal(prayer.normalizePrayerLocation({...jubail, obtainedAt:Date.now()+120000}), undefined);
  const result = prayer.normalizePrayerLocation({...jubail, latitude:27.010432, longitude:49.660712, altitude:31});
  assert.equal(result.latitude, 27.010); assert.equal(result.longitude, 49.661); assert.equal("altitude" in result, false);
});
test("Entering with ungranted permission does not prompt or invent a city", async () => {
  let calls=0; const store=gps.createPrayerLocationStore({permission:async()=>"prompt",position:async()=>{calls++;return jubail}},memoryStorage());
  await store.refreshIfGranted(); assert.equal(calls,0); assert.equal(store.getSnapshot().location,undefined);
  await store.request(); assert.equal(calls,1); assert.equal(store.getSnapshot().status,"ready");
});
test("All mounted surfaces share one GPS request and the travel result replaces the location", async () => {
  let finish; let calls=0;
  const store=gps.createPrayerLocationStore({permission:async()=>"granted",position:async()=>{calls++;return new Promise(resolve=>finish=resolve)}},memoryStorage(jubail));
  const requests=[store.request(),store.request(),store.refreshIfGranted()]; await Promise.resolve();
  assert.equal(calls,1); finish(riyadh); await Promise.all(requests);
  assert.equal(store.getSnapshot().location.longitude,riyadh.longitude); assert.equal(store.getSnapshot().status,"ready");
  store.setTimeZone(prayer.prayerLocationKey(jubail),"Asia/Riyadh"); assert.equal(store.getSnapshot().location.timeZone,undefined);
  store.setTimeZone(prayer.prayerLocationKey(riyadh),"Asia/Riyadh"); assert.equal(store.getSnapshot().location.timeZone,"Asia/Riyadh");
});
test("Granted permission refreshes on return without requesting permission again", async () => {
  let time=Date.now(), calls=0; const permissions=[];
  const store=gps.createPrayerLocationStore({permission:async()=>"granted",position:async ask=>{calls++;permissions.push(ask);return calls===1?jubail:riyadh}},memoryStorage(jubail),()=>time);
  await store.refreshIfGranted(); await store.refreshIfGranted(); assert.equal(calls,1);
  time+=61000; await store.refreshIfGranted(); assert.equal(calls,2); assert.deepEqual(permissions,[false,false]);
  assert.equal(store.getSnapshot().location.latitude,riyadh.latitude);
});
test("Denied permission removes active saved location instead of showing old city times", async () => {
  const storage=memoryStorage(jubail);
  const store=gps.createPrayerLocationStore({permission:async()=>"denied",position:async()=>{throw {code:1}}},storage);
  await store.refreshIfGranted(); assert.equal(store.getSnapshot().location,undefined); assert.equal(storage.getItem(gps.PRAYER_LOCATION_KEY),null);
  assert.match(store.getSnapshot().error,/إذن الموقع/);
});
test("GPS timeout or disabled service keeps a clearly marked last location; storage failures still work", async () => {
  const store=gps.createPrayerLocationStore({permission:async()=>"granted",position:async()=>{throw {code:"OS-PLUG-GLOC-0010"}}},memoryStorage(jubail));
  await store.request(); assert.equal(store.getSnapshot().status,"saved"); assert.equal(store.getSnapshot().location.latitude,jubail.latitude); assert.match(store.getSnapshot().error,/وقتًا طويلًا/);
  assert.match(gps.prayerLocationError({code:"OS-PLUG-GLOC-0007"}).message,/متوقفة/);
  const broken={getItem:()=>{throw Error()},setItem:()=>{throw Error()},removeItem:()=>{throw Error()}};
  const fallback=gps.createPrayerLocationStore({permission:async()=>"prompt",position:async()=>jubail},broken);
  await fallback.request(); assert.equal(fallback.getSnapshot().status,"ready");
});
test("Every displayed scan URL is from the verified Saudi university, and invalid pages are rejected", () => {
  for (let page = 1; page <= 604; page++) assert.equal(mushaf.mushafPageUrl(page), `https://quran.ksu.edu.sa/safahat/png_big/${page}.png`);
  for (const page of [0, -1, 605, 1.5, NaN, Infinity]) assert.throws(() => mushaf.mushafPageUrl(page));
});
test("The official navigation index has all surahs, juz and pages with correct known starts", () => {
  assert.equal(index.surahs.length, 114); assert.equal(index.pages.length, 604); assert.equal(index.juz.length, 30);
  assert.equal(index.surahs.reduce((total, item) => total + item.ayahs, 0), 6236);
  assert.equal(index.surahs.find(s => s.id === 1).page, 1);
  assert.equal(index.surahs.find(s => s.id === 2).page, 2);
  assert.equal(index.surahs.find(s => s.id === 18).page, 293);
  assert.equal(index.surahs.find(s => s.id === 114).page, 604);
  assert.equal(index.juz.at(-1).page, 582);
  assert.ok(mushaf.mushafPageLabel(604).includes("الناس"));
});
test("Spread reading preserves RTL odd/even pairs without requesting page 605", () => {
  assert.deepEqual(mushaf.mushafSpread(12, true), [11, 12]);
  assert.deepEqual(mushaf.mushafSpread(604, true), [603, 604]);
  assert.deepEqual(mushaf.mushafSpread(12, false), [12]);
});
test("Bookmarks are isolated by member and malformed stored pages cannot choose a scan", () => {
  const store = new Map(); globalThis.localStorage = { getItem: key => store.get(key) || null };
  store.set(mushaf.mushafBookmarkKey("member-a"), JSON.stringify({ page: 12 }));
  assert.equal(mushaf.readMushafBookmark("member-a"), 12);
  assert.equal(mushaf.readMushafBookmark("member-b"), null);
  for (const bad of [0, 605, -1, "../private", 1.5]) { store.set(mushaf.mushafBookmarkKey("member-a"), JSON.stringify({ page: bad })); assert.equal(mushaf.readMushafBookmark("member-a"), null); }
  delete globalThis.localStorage;
});
