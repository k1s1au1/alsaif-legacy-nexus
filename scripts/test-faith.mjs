import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { buildSync } from "esbuild";

const prayer = await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(readFileSync("src/lib/prayer-times.ts", "utf8"))).toString("base64"));
const compiled = buildSync({ entryPoints: ["src/lib/mushaf.ts"], bundle: true, platform: "node", format: "esm", write: false, tsconfig: "tsconfig.json" }).outputFiles[0].text;
const mushaf = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
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
test("Calendars cannot silently switch calculation method, date, or country timezone", () => {
  const make = () => ({ code: 200, data: Array.from({ length: 31 }, (_, i) => ({ timings: day(`2026-10-${String(i + 1).padStart(2, "0")}`).timings, date: { gregorian: { date: `${String(i + 1).padStart(2, "0")}-10-2026` } }, meta: { method: { id: 4 }, timezone: "Asia/Riyadh" } })) });
  assert.equal(prayer.normalizePrayerCalendar(make(), prayer.PRAYER_CITIES[0], 2026, 10).days.length, 31);
  for (const change of [x => x.meta.method.id = 3, x => x.meta.timezone = "Europe/London", x => x.date.gregorian.date = "01-11-2026", x => x.timings.Fajr = "05:00"]) {
    const payload = make(); change(payload.data[0]); assert.throws(() => prayer.normalizePrayerCalendar(payload, prayer.PRAYER_CITIES[0], 2026, 10));
  }
});
test("Cache is scoped to the exact selected city and month", () => {
  const store = new Map(); globalThis.localStorage = { getItem: key => store.get(key) || null };
  const calendar = { cityId: "riyadh", year: 2026, month: 10, method: 4, days: Array.from({ length: 31 }, (_, i) => day(`2026-10-${String(i + 1).padStart(2, "0")}`)) };
  store.set(prayer.prayerCacheKey("riyadh", 2026, 10), JSON.stringify(calendar));
  assert.equal(prayer.readPrayerCalendar(prayer.PRAYER_CITIES[0], 2026, 10).days.length, 31);
  assert.equal(prayer.readPrayerCalendar(prayer.PRAYER_CITIES[1], 2026, 10), undefined);
  store.set(prayer.prayerCacheKey("makkah", 2026, 10), JSON.stringify(calendar));
  assert.equal(prayer.readPrayerCalendar(prayer.PRAYER_CITIES[1], 2026, 10), undefined);
  delete globalThis.localStorage;
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
