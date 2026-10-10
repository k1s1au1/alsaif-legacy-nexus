import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Exercise the production migration against PostgreSQL, including RLS and
// field-level triggers. No production members, trips or messages are involved.
test("trip planning, approval, attendance and preparation permissions persist in PostgreSQL", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const tripId = uid(100),
    itemId = uid(101);
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id));
    CREATE TABLE public.test_roles (id uuid, role text, section text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION public.is_family_member(u uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.test_roles WHERE id=u AND role<>'guest') $$;
    CREATE FUNCTION public.can_manage_section(u uuid,s text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.test_roles WHERE id=u AND (role IN ('chairman','vice_chairman') OR section=s)) $$;
    CREATE FUNCTION public.has_role(u uuid,r text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at:=now(); RETURN NEW; END $$;
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at:=now(); RETURN NEW; END $$;
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
    GRANT SELECT ON public.profiles TO authenticated;
  `);
  for (const [n, role, section] of [
    [1, "member", null],
    [2, "member", null],
    [3, "chairman", null],
    [4, "vice_chairman", null],
    [5, "member", "trips"],
    [6, "technical_admin", null],
    [7, "guest", null],
  ]) {
    await db.query("INSERT INTO auth.users VALUES ($1);", [uid(n)]);
    await db.query("INSERT INTO public.profiles VALUES ($1);", [uid(n)]);
    await db.query("INSERT INTO public.test_roles VALUES ($1,$2,$3);", [uid(n), role, section]);
  }
  const read = (name) =>
    fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
  await db.exec(read("20260613043855_7d096d19-7219-48fd-bbf2-761b5c142f5e.sql"));
  await db.exec(read("20260613051336_caa15d9e-5551-49e3-bb0d-1d11f231fe60.sql"));
  await db.exec(
    read("20260629104417_7cccee4f-d6d9-45c1-9fc4-98e3af1f55ee.sql").split("-- Migrate existing")[0],
  );
  await db.exec(`
    ALTER TABLE public.trips ADD COLUMN location_url text;
    DROP POLICY "Authenticated can create trips" ON public.trips;
    DROP POLICY "Creators or admins can update trips" ON public.trips;
    DROP POLICY "Creators or admins can delete trips" ON public.trips;
    CREATE POLICY "Trip managers can insert" ON public.trips FOR INSERT TO authenticated WITH CHECK (public.can_manage_section(auth.uid(),'trips'));
    CREATE POLICY "Trip managers can update" ON public.trips FOR UPDATE TO authenticated USING (public.can_manage_section(auth.uid(),'trips'));
    INSERT INTO public.trips (id,title,status,location,start_date,end_date,created_by) VALUES ('${tripId}','Legacy trip','upcoming','العلا','2099-01-01','2099-01-03','${uid(3)}');
    INSERT INTO public.trip_attendees (trip_id,user_id) VALUES ('${tripId}','${uid(1)}');
  `);
  const migration = read("20261010071000_trip_planning_and_preparations.sql");
  await db.exec(migration);
  await db.exec(migration); // Safe to apply from SQL editor and migration runner.
  const as = async (n) => {
    await db.exec("RESET ROLE;");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid(n)]);
    await db.exec("SET ROLE authenticated;");
  };
  const row = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const rejects = async (sql, args = []) => assert.rejects(db.query(sql, args));
  await as(3);
  await db.query("INSERT INTO trips (id,title,created_by) VALUES ($1,'New plan',$2)", [
    uid(120),
    uid(3),
  ]);
  assert.equal((await row("SELECT status FROM trips WHERE id=$1", [uid(120)])).status, "planning");
  assert.equal(
    (await row("SELECT approval_version FROM trips WHERE id=$1", [tripId])).approval_version,
    1,
  );
  assert.equal(
    (await row("SELECT companions_count FROM trip_attendees WHERE trip_id=$1", [tripId]))
      .companions_count,
    0,
  );
  await db.query("UPDATE trips SET status='planning' WHERE id=$1", [tripId]);
  const destinations = JSON.stringify([
    { id: "a", name: "العلا" },
    { id: "b", name: "الطائف" },
  ]);
  const dates = JSON.stringify([{ id: "d", start_date: "2099-02-01", end_date: "2099-02-03" }]);
  await db.query("UPDATE trips SET planning_destinations=$2,planning_dates=$3 WHERE id=$1", [
    tripId,
    destinations,
    dates,
  ]);
  let plan = await row("SELECT * FROM trips WHERE id=$1", [tripId]);
  await as(1);
  await rejects("INSERT INTO trips (title,created_by) VALUES ('member plan',$1)", [uid(1)]);
  await db.query("SELECT save_trip_preference($1,true,'b','d',$2)", [
    tripId,
    plan.planning_revision,
  ]);
  assert.equal(
    (await row("SELECT count(*)::int AS n FROM trip_preferences WHERE interested")).n,
    1,
  );
  assert.equal(
    (await row("SELECT count(*)::int AS n FROM trip_attendees")).n,
    1,
    "interest creates no actual attendance row",
  );
  await rejects("SELECT save_trip_preference($1,true,'missing','d',$2)", [
    tripId,
    plan.planning_revision,
  ]);
  await rejects("SELECT save_trip_preference($1,true,'b','d',0)", [tripId]);
  await rejects("SELECT approve_trip_plan($1,'العلا','2099-02-01','2099-02-03',$2)", [
    tripId,
    plan.planning_revision,
  ]);
  await rejects("INSERT INTO trip_items (trip_id,name,created_by) VALUES ($1,'too soon',$2)", [
    tripId,
    uid(1),
  ]);
  await rejects("SELECT set_trip_attendance($1,'going',5,$2)", [tripId, plan.approval_version]);
  await as(7);
  await rejects("SELECT save_trip_preference($1,true,'b','d',$2)", [
    tripId,
    plan.planning_revision,
  ]);
  await as(6);
  await rejects("SELECT approve_trip_plan($1,'العلا','2099-02-01','2099-02-03',$2)", [
    tripId,
    plan.planning_revision,
  ]);
  await as(5);
  await rejects("SELECT approve_trip_plan($1,'','2099-02-01','2099-02-03',$2)", [
    tripId,
    plan.planning_revision,
  ]);
  await rejects("SELECT approve_trip_plan($1,'العلا','2099-02-03','2099-02-01',$2)", [
    tripId,
    plan.planning_revision,
  ]);
  await rejects("SELECT approve_trip_plan($1,'العلا','2000-02-01','2000-02-03',$2)", [
    tripId,
    plan.planning_revision,
  ]);
  await db.query("SELECT approve_trip_plan($1,'الطائف','2099-02-01','2099-02-03',$2)", [
    tripId,
    plan.planning_revision,
  ]);
  plan = await row("SELECT * FROM trips WHERE id=$1", [tripId]);
  assert.equal(plan.status, "upcoming");
  assert.equal(plan.location, "الطائف");
  await as(1);
  await rejects("SELECT set_trip_attendance($1,'going',5,1)", [tripId]);
  await db.query("SELECT set_trip_attendance($1,'going',5,$2)", [tripId, plan.approval_version]);
  let attendance = await row("SELECT * FROM trip_attendees WHERE trip_id=$1 AND user_id=$2", [
    tripId,
    uid(1),
  ]);
  assert.equal(attendance.companions_count, 5);
  assert.equal(attendance.approval_version, plan.approval_version);
  await rejects("SELECT set_trip_attendance($1,'going',51,$2)", [tripId, plan.approval_version]);
  await db.query("SELECT set_trip_attendance($1,'not_going',0,$2)", [
    tripId,
    plan.approval_version,
  ]);
  assert.equal(
    (
      await row("SELECT status FROM trip_attendees WHERE trip_id=$1 AND user_id=$2", [
        tripId,
        uid(1),
      ])
    ).status,
    "not_going",
  );
  await db.query(
    "INSERT INTO trip_items (id,trip_id,name,notes,created_by) VALUES ($1,$2,'ضيافة','قهوة وماء',$3)",
    [itemId, tripId, uid(1)],
  );
  await rejects(
    "INSERT INTO trip_items (trip_id,name,created_by,assigned_to) VALUES ($1,'assign other',$2,$3)",
    [tripId, uid(1), uid(2)],
  );
  await as(2);
  await rejects("UPDATE trip_items SET name='changed by other' WHERE id=$1", [itemId]);
  await db.query("SELECT set_trip_item_state($1,'claim')", [itemId]);
  await as(1);
  await rejects("SELECT set_trip_item_state($1,'claim')", [itemId]);
  await rejects("UPDATE trip_items SET assigned_to=$2 WHERE id=$1", [itemId, uid(1)]);
  await rejects("UPDATE trip_items SET assigned_to=NULL WHERE id=$1", [itemId]);
  await rejects("UPDATE trip_items SET completed_at=now() WHERE id=$1", [itemId]);
  await db.query("UPDATE trip_items SET notes='updated by creator' WHERE id=$1", [itemId]);
  await as(2);
  await db.query("SELECT set_trip_item_state($1,'complete')", [itemId]);
  assert.ok((await row("SELECT completed_at FROM trip_items WHERE id=$1", [itemId])).completed_at);
  const deleted = await db.query("DELETE FROM trip_items WHERE id=$1 RETURNING id", [itemId]);
  assert.equal(deleted.rows.length, 0, "an assignee cannot delete another creator's item");
  await as(4);
  await db.query("SELECT set_trip_item_state($1,'reopen')", [itemId]);
  await db.query("SELECT set_trip_item_state($1,'release')", [itemId]);
  assert.equal(
    (await row("SELECT assigned_to FROM trip_items WHERE id=$1", [itemId])).assigned_to,
    null,
  );
  await db.query("UPDATE trips SET end_date='2099-02-04' WHERE id=$1", [tripId]);
  const changed = await row("SELECT * FROM trips WHERE id=$1", [tripId]);
  assert.ok(changed.approval_version > plan.approval_version);
  await as(1);
  await rejects("SELECT set_trip_attendance($1,'going',5,$2)", [tripId, plan.approval_version]);
  await db.query("DELETE FROM trip_items WHERE id=$1", [itemId]);
  assert.equal((await row("SELECT count(*)::int AS n FROM trip_items")).n, 0);
});
