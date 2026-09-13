import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const parentSource = fs.readFileSync(new URL("../src/routes/_authenticated/route.tsx", import.meta.url), "utf8");
const retiredSource = fs.readFileSync(new URL("../src/routes/_authenticated/onboarding.tsx", import.meta.url), "utf8");

// Exercise the actual route guards; JSX components are outside this extracted function.
function routeGuard(source, getCurrentUser = async () => ({ data: { user: null } })) {
  const start = source.indexOf("  beforeLoad: ") + "  beforeLoad: ".length;
  const end = source.indexOf("  component:", start);
  assert.ok(start > 0 && end > start, "route guard must remain present");
  const fn = source.slice(start, end).trim().replace(/,$/, "");
  return vm.runInNewContext(`(${fn})`, {
    getCurrentUser,
    redirect: (options) => ({ ...options, status: 307 }),
    // Any profile query or write would incorrectly make personal details an entry requirement.
    supabase: new Proxy({}, { get() { throw new Error("Unexpected profile access in auth guard"); } }),
    console: { error() {} },
  });
}

const location = { pathname: "/dashboard" };

test("accepted new member enters with no three-part name or birth fields", async () => {
  const user = { id: "accepted-member", user_metadata: { full_name: "عضو جديد" } };
  let calls = 0;
  const guard = routeGuard(parentSource, async () => {
    calls += 1;
    return { data: { user }, error: null };
  });
  assert.equal((await guard({ location })).user, user);
  assert.equal(calls, 1);
});

test("existing signed-in member keeps normal access", async () => {
  const user = { id: "existing-member" };
  const guard = routeGuard(parentSource, async () => ({ data: { user }, error: null }));
  assert.equal((await guard({ location: { pathname: "/profile" } })).user, user);
});

test("anonymous visitors are still sent to sign-in", async () => {
  const guard = routeGuard(parentSource, async () => ({ data: { user: null }, error: null }));
  await assert.rejects(guard({ location }), (error) => error.to === "/auth");
});

test("an authentication error does not grant access", async () => {
  const guard = routeGuard(parentSource, async () => ({ data: { user: { id: "invalid-session" } }, error: new Error("Invalid session") }));
  await assert.rejects(guard({ location }), (error) => error.to === "/auth");
});

test("existing recoverable/offline auth fallback remains", async () => {
  const user = { id: "cached-member" };
  let calls = 0;
  const guard = routeGuard(parentSource, async () => {
    if (++calls === 1) throw new Error("Temporary auth read failure");
    return { data: { user } };
  });
  assert.equal((await guard({ location })).user, user);
  assert.equal(calls, 2);
});

test("failed fallback without a user is still denied", async () => {
  let calls = 0;
  const guard = routeGuard(parentSource, async () => {
    if (++calls === 1) throw new Error("Temporary auth read failure");
    return { data: { user: null } };
  });
  await assert.rejects(guard({ location }), (error) => error.to === "/auth");
});

test("old onboarding bookmarks go to dashboard without a loop", async () => {
  const user = { id: "accepted-member" };
  const parent = routeGuard(parentSource, async () => ({ data: { user }, error: null }));
  assert.equal((await parent({ location: { pathname: "/onboarding" } })).user, user);
  const child = routeGuard(retiredSource);
  assert.throws(() => child(), (error) => error.to === "/dashboard" && error.replace === true);
  assert.ok(!parentSource.includes('to: "/onboarding"'));
});

test("retired form is gone and terms/layout protections stay", () => {
  assert.ok(!retiredSource.includes("أكمل بياناتك"));
  assert.ok(!retiredSource.includes("<form"));
  assert.ok(!retiredSource.includes(".update("));
  assert.ok(parentSource.includes("<TermsGate>"));
  assert.ok(parentSource.includes("<AppShellLayout>"));
});
