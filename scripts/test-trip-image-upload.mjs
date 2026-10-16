import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(client) {
  const source = fs.readFileSync(
    new URL("../src/lib/trip-image-upload.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", compiled)(module, module.exports, () => ({
    supabase: client,
  }));
  return module.exports;
}

test("new trip photos retain their contents and use unique paths inside the signed-in user's folder", async () => {
  const calls = [];
  const { uploadTripImage } = load({
    storage: {
      from(bucket) {
        return {
          async upload(...args) {
            calls.push({ bucket, args });
            return { error: null };
          },
        };
      },
    },
  });
  const file = new File(["photo bytes"], "العلا.jpeg", { type: "image/jpeg" });
  const first = await uploadTripImage(file, "member-id");
  const second = await uploadTripImage(file, "member-id");
  assert.match(first, /^member-id\/[a-f0-9-]{36}\.jpeg$/);
  assert.notEqual(first, second);
  for (const call of calls) {
    assert.equal(call.bucket, "trip-images");
    assert.equal(call.args[1], file);
    assert.equal(call.args.length, 2, "No upsert or public-access change is needed");
  }
});

test("RLS, expired sessions, large files and unsupported types have distinct Arabic explanations", () => {
  const { tripImageUploadErrorDescription: describe } = load({});
  for (const error of [
    { statusCode: "403" },
    { code: "AccessDenied" },
    { statusCode: "400", message: "new row violates row-level security policy" },
  ]) {
    assert.match(describe(error), /صلاحية رفع صور الرحلات/);
  }
  for (const error of [{ status: 401 }, { code: "InvalidJWT" }])
    assert.match(describe(error), /جلسة تسجيل الدخول/);
  for (const error of [{ statusCode: "413" }, { code: "EntityTooLarge" }])
    assert.match(describe(error), /حجم أصغر/);
  for (const error of [{ status: 415 }, { code: "InvalidMimeType" }])
    assert.match(describe(error), /JPG أو PNG/);
  assert.match(describe({ code: "NoSuchBucket" }), /غير متاحة/);
  for (const message of ["Failed to fetch", "Load failed", "Network request failed"])
    assert.match(describe(new TypeError(message)), /الإنترنت/);
  for (const error of [null, undefined, {}, "unexpected failure"])
    assert.match(describe(error), /أعد المحاولة/);
});

test("returned storage errors and thrown network failures both reject before a photo path can be saved", async () => {
  const file = new File(["photo"], "photo.png", { type: "image/png" });
  for (const thrown of [false, true]) {
    const cause = thrown
      ? new TypeError("Load failed")
      : { code: "AccessDenied", statusCode: "403" };
    const { uploadTripImage, TripImageUploadError } = load({
      storage: {
        from: () => ({
          upload: async () => {
            if (thrown) throw cause;
            return { error: cause };
          },
        }),
      },
    });
    await assert.rejects(uploadTripImage(file, "member-id"), (error) => {
      assert.ok(error instanceof TripImageUploadError);
      assert.equal(error.cause, cause);
      assert.match(error.message, thrown ? /الإنترنت/ : /صلاحية رفع/);
      return true;
    });
  }
});
