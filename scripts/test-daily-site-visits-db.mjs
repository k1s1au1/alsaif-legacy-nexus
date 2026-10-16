import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("actual visit migration deduplicates real presence writes, resets on the Saudi day and keeps the register private", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE public.profiles (id uuid PRIMARY KEY, is_active boolean NOT NULL DEFAULT true);
    CREATE TABLE public.test_roles (user_id uuid, role text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION public.is_family_member(u uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT u IS NOT NULL AND EXISTS (SELECT 1 FROM public.test_roles WHERE user_id=u) $$;
    CREATE FUNCTION public.test_visit_now() RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT current_setting('test.visit_now')::timestamptz $$;
    CREATE TABLE public.user_presence (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, last_seen_at timestamptz, status text DEFAULT 'online');
    ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
    GRANT SELECT,INSERT,UPDATE ON public.user_presence TO authenticated;
    CREATE POLICY own_presence ON public.user_presence TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
  `);
  for (let n = 1; n <= 6; n++) {
    await db.query("INSERT INTO auth.users VALUES ($1);", [uid(n)]);
    await db.query("INSERT INTO public.profiles VALUES ($1,$2)", [uid(n), n !== 5]);
    if (n !== 6) await db.query("INSERT INTO public.test_roles VALUES ($1,$2)", [uid(n), n === 2 ? "chairman" : "member"]);
  }
  const now = async value => db.query("SELECT set_config('test.visit_now',$1,false)", [value]);
  const as = async (n, role = "authenticated") => {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [n ? uid(n) : ""]);
    await db.exec(`SET ROLE ${role}`);
  };
  const beat = (n, claimedTime = "2099-01-01T00:00:00Z", status = "online") => db.query(
    "INSERT INTO public.user_presence (user_id,last_seen_at,status) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at,status=EXCLUDED.status",
    [uid(n), claimedTime, status],
  );
  const count = async () => (await db.query("SELECT public.get_today_site_visit_count() AS summary")).rows[0].summary;
  await now("2026-10-16T20:59:59Z");
  // One known visitor today, one yesterday, one impossible future timestamp.
  await beat(1, "2026-10-16T12:00:00Z");
  await beat(3, "2026-10-15T20:00:00Z");
  await beat(4);
  const productionSql = fs.readFileSync(new URL("../supabase/migrations/20261016153000_daily_family_visitors.sql", import.meta.url), "utf8");
  // Test seam: execute the real migration with a controllable server clock. The
  // production source still uses statement_timestamp(), never a caller argument.
  const sql = productionSql.replaceAll("statement_timestamp()", "public.test_visit_now()");
  await db.exec(sql);
  await db.exec(sql); // Safe to reapply, including the initial seed.
  await as(1);
  assert.deepEqual(await count(), { visit_date: "2026-10-16", visitor_count: 1 });
  for (let i = 0; i < 20; i++) await beat(1);
  assert.equal((await count()).visitor_count, 1, "Refreshes, re-entry and another device share the account/day key");
  await as(2); await beat(2);
  assert.equal((await count()).visitor_count, 2);
  await assert.rejects(beat(3), /row-level security/);
  for (const operation of [
    "SELECT * FROM public.daily_site_visits",
    `INSERT INTO public.daily_site_visits (visit_date,user_id) VALUES ('2026-10-17','${uid(3)}')`,
    "UPDATE public.daily_site_visits SET visit_date='2026-10-17'",
    "DELETE FROM public.daily_site_visits",
    "SELECT public.record_daily_site_visit_from_presence()",
  ]) await assert.rejects(db.query(operation), /permission denied/, operation);

  await now("2026-10-16T21:00:00Z");
  assert.deepEqual(await count(), { visit_date: "2026-10-17", visitor_count: 0 }, "Saudi midnight starts a fresh day without deleting history");
  await beat(2, "1990-01-01T00:00:00Z");
  assert.deepEqual(await count(), { visit_date: "2026-10-17", visitor_count: 1 }, "The server assigns the day, not the device timestamp");
  await as(1); await beat(1); await beat(1);
  assert.equal((await count()).visitor_count, 2);
  await as(3); await beat(3, undefined, "offline");
  assert.equal((await count()).visitor_count, 2, "An offline state change is not a visit");
  await beat(3);
  assert.equal((await count()).visitor_count, 3);
  for (const n of [5, 6]) {
    await as(n); await beat(n);
    await assert.rejects(count(), /غير مصرح/);
  }
  await as(null);
  await assert.rejects(count(), /غير مصرح/);
  await as(1, "anon");
  await assert.rejects(count(), /permission denied/);
  await db.exec("RESET ROLE");
  const rows = (await db.query("SELECT visit_date::text AS day,count(*)::int AS n FROM public.daily_site_visits GROUP BY visit_date ORDER BY visit_date")).rows;
  assert.deepEqual(rows, [{ day: "2026-10-16", n: 2 }, { day: "2026-10-17", n: 3 }]);
  await db.query("DELETE FROM auth.users WHERE id=$1", [uid(1)]);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.daily_site_visits WHERE user_id=$1", [uid(1)])).rows[0].n, 0, "Deleting an account cascades its visit records");
});
