import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const configSource = fs.readFileSync(
  new URL("../src/lib/api/supabase-auth.middleware.ts", import.meta.url),
  "utf8",
);
const clientSource = fs.readFileSync(
  new URL("../src/integrations/supabase/client.server.ts", import.meta.url),
  "utf8",
);

function serverClients(runtime = {}, build = {}) {
  const start = configSource.indexOf("export const resolveSupabaseUrl");
  const end = configSource.indexOf("/** Admin", start);
  assert.ok(start >= 0 && end > start, "connection resolvers must be present");
  const resolvers = configSource
    .slice(start, end)
    .replaceAll("export const", "const")
    .replaceAll("import.meta.env", "buildEnv");
  const clients = clientSource
    .replace(/import type[^\n]*\n/, "")
    .replace(/import \{[\s\S]*?\} from "@\/lib\/api\/supabase-auth.middleware";\n/, "")
    .replaceAll("export const", "const")
    .replaceAll("createClient<Database>", "createClient")
    .replace("(token: string)", "(token)")
    .replaceAll('await import("@supabase/supabase-js")', "await loadSupabase()");
  return vm.runInNewContext(
    `${resolvers}\n${clients}\n({ getSupabaseAdmin, getSupabaseUserClient });`,
    {
      process: { env: runtime },
      buildEnv: build,
      console: { warn() {} },
      // Observe the exact client configuration without contacting a live database.
      loadSupabase: async () => ({
        createClient: (url, key, options) => ({ url, key, options }),
      }),
    },
  );
}

function assertUserClient(client, url, key, token) {
  assert.ok(client);
  assert.equal(client.url, url);
  assert.equal(client.key, key);
  assert.equal(client.options.global.headers.Authorization, `Bearer ${token}`);
  assert.equal(client.options.auth.persistSession, false);
  assert.equal(client.options.auth.autoRefreshToken, false);
}

test("backup user client accepts the server publishable key", async () => {
  const { getSupabaseUserClient } = serverClients({
    SUPABASE_URL: "https://runtime.example.test",
    SUPABASE_PUBLISHABLE_KEY: "runtime-public",
  });
  assertUserClient(
    await getSupabaseUserClient("member-token"),
    "https://runtime.example.test",
    "runtime-public",
    "member-token",
  );
});

test("build-time connection values support the user and privileged backup clients", async () => {
  const { getSupabaseUserClient, getSupabaseAdmin } = serverClients(
    { SUPABASE_SERVICE_ROLE_KEY: "server-only-secret" },
    {
      VITE_SUPABASE_URL: "https://build.example.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: "build-public",
    },
  );
  assertUserClient(
    await getSupabaseUserClient("member-token"),
    "https://build.example.test",
    "build-public",
    "member-token",
  );
  const admin = await getSupabaseAdmin();
  assert.equal(admin.url, "https://build.example.test");
  assert.equal(admin.key, "server-only-secret");
  assert.equal(admin.options.auth.persistSession, false);
  assert.equal(admin.options.auth.autoRefreshToken, false);
  assert.equal(admin.options.global, undefined);
});

test("runtime configuration wins over build-time defaults", async () => {
  const { getSupabaseUserClient } = serverClients(
    {
      SUPABASE_URL: "https://runtime.example.test",
      SUPABASE_PUBLISHABLE_KEY: "runtime-public",
      SUPABASE_ANON_KEY: "legacy-public",
    },
    {
      VITE_SUPABASE_URL: "https://build.example.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: "build-public",
    },
  );
  assertUserClient(
    await getSupabaseUserClient("member-token"),
    "https://runtime.example.test",
    "runtime-public",
    "member-token",
  );
});

test("legacy and runtime VITE names keep working", async () => {
  for (const runtime of [
    { SUPABASE_URL: "https://legacy.example.test", SUPABASE_ANON_KEY: "legacy-public" },
    { VITE_SUPABASE_URL: "https://legacy.example.test", VITE_SUPABASE_PUBLISHABLE_KEY: "legacy-public" },
  ]) {
    const { getSupabaseUserClient } = serverClients(runtime);
    assertUserClient(
      await getSupabaseUserClient("member-token"),
      "https://legacy.example.test",
      "legacy-public",
      "member-token",
    );
  }
});

test("a service key cannot replace a missing user-client publishable key", async () => {
  const { getSupabaseUserClient } = serverClients({
    SUPABASE_URL: "https://runtime.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-secret",
  });
  assert.equal(await getSupabaseUserClient("member-token"), null);
});

test("a privileged client cannot use a public or build-time secret fallback", async () => {
  const { getSupabaseAdmin } = serverClients(
    {
      SUPABASE_URL: "https://runtime.example.test",
      SUPABASE_PUBLISHABLE_KEY: "runtime-public",
    },
    { VITE_SUPABASE_SERVICE_ROLE_KEY: "never-use-a-bundled-secret" },
  );
  assert.equal(await getSupabaseAdmin(), null);
});

test("missing connection values fail closed", async () => {
  const { getSupabaseUserClient, getSupabaseAdmin } = serverClients();
  assert.equal(await getSupabaseUserClient("member-token"), null);
  assert.equal(await getSupabaseAdmin(), null);
});

test("separate requests retain each user's bearer token", async () => {
  const { getSupabaseUserClient } = serverClients({
    SUPABASE_URL: "https://runtime.example.test",
    SUPABASE_PUBLISHABLE_KEY: "runtime-public",
  });
  const [first, second] = await Promise.all([
    getSupabaseUserClient("first-member"),
    getSupabaseUserClient("second-member"),
  ]);
  assert.notEqual(first, second);
  assert.equal(first.options.global.headers.Authorization, "Bearer first-member");
  assert.equal(second.options.global.headers.Authorization, "Bearer second-member");
});
