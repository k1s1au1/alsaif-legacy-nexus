import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSync } from "esbuild";

async function source(path) {
  const code = buildSync({ entryPoints: [path], bundle: true, platform: "node", format: "esm", write: false }).outputFiles[0].text;
  return import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
}
const { councilOasisClock: clock } = await source("src/lib/council-oasis.ts");
const prayer = await source("src/lib/prayer-times.ts");
const solar = { date: "2026-10-16", sunrise: "2026-10-16T05:41:00+03:00", sunset: "2026-10-16T17:12:00+03:00" };

test("The scenery changes at the verified sunrise and sunset, including exact instants", () => {
  for (const [time, period, boundary] of [
    ["05:40:59", "night", solar.sunrise], ["05:41:00", "day", solar.sunset],
    ["17:11:59", "day", solar.sunset], ["17:12:00", "night", undefined],
  ]) {
    const result = clock(new Date(`2026-10-16T${time}+03:00`), solar);
    assert.equal(result.period, period); assert.equal(result.source, "solar");
    assert.equal(result.nextChangeAt, boundary ? Date.parse(boundary) : undefined);
  }
});
test("No-GPS and legacy calendars use 06:00–18:00 in the device timezone", () => {
  for (const [time, period] of [["05:59:59", "night"], ["06:00:00", "day"], ["17:59:59", "day"], ["18:00:00", "night"]]) {
    const result = clock(new Date(`2026-10-16T${time}+03:00`), undefined, "Asia/Riyadh");
    assert.equal(result.period, period); assert.equal(result.source, "clock");
  }
  assert.equal(clock(new Date("2026-10-16T15:00:00Z"), undefined, "America/Los_Angeles").period, "day");
  assert.equal(clock(new Date("2026-10-16T15:00:00Z"), undefined, "Asia/Riyadh").period, "night");
  assert.equal(clock(new Date("2026-10-16T15:00:00Z"), undefined, "invalid").period, "night");
});
test("Yesterday's solar metadata cannot keep the night scene after local sunrise", () => {
  for (const today of ["2026-10-17", "2026-11-01", "2027-01-01"]) {
    const result = clock(new Date(`${today}T08:00:00+03:00`), solar);
    assert.equal(result.period, "day"); assert.equal(result.source, "clock");
  }
  for (const broken of [
    { ...solar, sunrise: "invalid" }, { ...solar, sunset: "" },
    { ...solar, sunrise: solar.sunset, sunset: solar.sunrise },
    { ...solar, sunrise: "2026-10-15T05:41:00+03:00" },
  ]) assert.equal(clock(new Date("2026-10-16T08:00:00+03:00"), broken).source, "clock");
});
test("The resolved location timezone controls solar dates across travel and DST", () => {
  const date = new Date("2026-11-01T14:00:00Z");
  const local = { date: "2026-11-01", sunrise: "2026-11-01T06:12:00-08:00", sunset: "2026-11-01T16:59:00-08:00" };
  assert.equal(clock(date, local, "America/Los_Angeles").source, "solar");
  assert.equal(clock(date, local, "America/Los_Angeles").period, "night");
  assert.equal(clock(new Date("2026-11-01T14:12:00Z"), local, "America/Los_Angeles").period, "day");
  assert.equal(clock(new Date("2026-10-16T05:00:00+03:00"), solar).greeting, "صباح الخير");
  assert.equal(clock(new Date("2026-10-16T14:00:00+03:00"), solar).greeting, "مساء النور");
  assert.equal(clock(new Date("2026-10-16T20:00:00+03:00"), solar).greeting, "مساء الخير");
});

const location = { latitude: 27.010, longitude: 49.660, accuracy: 25, obtainedAt: Date.now() };
function calendar(includeSolar = true) {
  return { code: 200, data: Array.from({ length: 31 }, (_, i) => {
    const date = `2026-10-${String(i + 1).padStart(2, "0")}`;
    const times = [["Fajr", "05:00"], ["Dhuhr", "12:00"], ["Asr", "15:15"], ["Maghrib", "17:12"], ["Isha", "18:42"], ...(includeSolar ? [["Sunrise", "05:41"], ["Sunset", "17:12"]] : [])];
    return { date: { gregorian: { date: date.split("-").reverse().join("-") } }, timings: Object.fromEntries(times.map(([key, value]) => [key, `${date}T${value}:00+03:00`])), meta: { ...location, method: { id: 4 }, timezone: "Asia/Riyadh" } };
  }) };
}
test("Optional solar metadata survives the existing verified prayer cache", () => {
  const normalized = prayer.normalizePrayerCalendar(calendar(), location, 2026, 10);
  assert.equal(normalized.days[15].sunrise, solar.sunrise);
  assert.equal(normalized.days[15].sunset, solar.sunset);
  const key = prayer.prayerCacheKey(location, 2026, 10);
  const values = new Map([[key, JSON.stringify(normalized)]]);
  globalThis.localStorage = { getItem: key => values.get(key) || null };
  try {
    assert.deepEqual(prayer.readPrayerCalendar(location, 2026, 10), normalized);
    const legacy = prayer.normalizePrayerCalendar(calendar(false), location, 2026, 10);
    values.set(key, JSON.stringify(legacy));
    assert.deepEqual(prayer.readPrayerCalendar(location, 2026, 10), legacy);
    assert.equal(legacy.days[15].sunrise, undefined);
    assert.equal(Object.keys(legacy.days[15].timings).length, 5);
  } finally { delete globalThis.localStorage; }
});
test("Missing or unverified daylight fields never discard the five valid prayer times", () => {
  for (const value of [undefined, "05:41", "invalid", "2026-10-01T05:41:00+00:00", "2026-10-02T05:41:00+03:00", "2026-10-01T18:00:00+03:00"]) {
    const payload = calendar(); payload.data[0].timings.Sunrise = value;
    const normalized = prayer.normalizePrayerCalendar(payload, location, 2026, 10);
    assert.equal(normalized.days[0].sunrise, undefined);
    assert.equal(normalized.days[0].sunset, undefined);
    assert.equal(Object.keys(normalized.days[0].timings).length, 5);
    assert.equal(normalized.days[1].sunrise, "2026-10-02T05:41:00+03:00");
  }
});
