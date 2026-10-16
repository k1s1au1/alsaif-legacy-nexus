import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("trip section managers can upload their own photos without opening other folders, buckets or operations", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE public.test_roles (user_id uuid, role text, section text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION public.can_manage_section(u uuid,s text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.test_roles WHERE user_id=u AND (role IN ('chairman','vice_chairman') OR section=s)) $$;
    CREATE FUNCTION public.has_role(u uuid,r text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.test_roles WHERE user_id=u AND role=r) $$;
    CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql AS $$ SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, public boolean);
    INSERT INTO storage.buckets VALUES ('trip-images',false),('other-images',false);
    CREATE TABLE storage.objects (bucket_id text, name text, PRIMARY KEY (bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;
    CREATE POLICY "Authenticated can view trip images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='trip-images');
    CREATE POLICY "Admins and managers can upload trip images" ON storage.objects FOR INSERT WITH CHECK (bucket_id='trip-images' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'chairman')));
  `);
  for (const [n, role, section] of [
    [1, "member", null],
    [2, "chairman", null],
    [3, "vice_chairman", null],
    [4, "member", "trips"],
    [5, "member", "news"],
    [6, "technical_admin", null],
    [7, "technical_admin", "trips"],
    [8, "admin", null],
    [9, "manager", null],
  ])
    await db.query("INSERT INTO public.test_roles VALUES ($1,$2,$3)", [uid(n), role, section]);

  const as = async (n, role = "authenticated") => {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [n ? uid(n) : ""]);
    await db.exec(`SET ROLE ${role}`);
  };
  const upload = (n, name, bucket = "trip-images") =>
    db.query("INSERT INTO storage.objects (bucket_id,name) VALUES ($1,$2) RETURNING name", [
      bucket,
      name ?? `${uid(n)}/photo.jpg`,
    ]);
  for (const n of [3, 4, 7]) {
    await as(n);
    await assert.rejects(upload(n), /row-level security/);
  }
  await db.exec("RESET ROLE");
  const migration = fs.readFileSync(
    new URL("../supabase/migrations/20261016073000_trip_manager_image_upload.sql", import.meta.url),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);

  for (const n of [2, 3, 4, 7, 8, 9]) {
    await as(n);
    assert.equal((await upload(n)).rows.length, 1);
  }
  for (const n of [1, 5, 6]) {
    await as(n);
    await assert.rejects(upload(n), /row-level security/);
  }
  for (const n of [3, 4, 7]) {
    await as(n);
    await assert.rejects(upload(n, `${uid(1)}/foreign-photo.jpg`), /row-level security/);
    await assert.rejects(
      upload(n, `${uid(n)}/other-photo.jpg`, "other-images"),
      /row-level security/,
    );
    await assert.rejects(upload(n, "root-photo.jpg"), /row-level security/);
    assert.deepEqual(
      (
        await db.query(
          "UPDATE storage.objects SET name='changed.jpg' WHERE name=$1 RETURNING name",
          [`${uid(n)}/photo.jpg`],
        )
      ).rows,
      [],
    );
    assert.deepEqual(
      (
        await db.query("DELETE FROM storage.objects WHERE name=$1 RETURNING name", [
          `${uid(n)}/photo.jpg`,
        ])
      ).rows,
      [],
    );
  }
  await as(3, "anon");
  await assert.rejects(upload(3, `${uid(3)}/anon.jpg`), /row-level security/);
  await as(null);
  await assert.rejects(upload(3, `${uid(3)}/no-session.jpg`), /row-level security/);
  await db.exec("RESET ROLE");
  assert.equal(
    (await db.query("SELECT public FROM storage.buckets WHERE id='trip-images'")).rows[0].public,
    false,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='storage' AND tablename='objects'",
      )
    ).rows[0].n,
    3,
  );
});
