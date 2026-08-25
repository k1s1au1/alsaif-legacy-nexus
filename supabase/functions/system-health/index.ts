// Edge function: system-health
// Runs authenticated, read-only service checks for the executive admin dashboard.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
};

type HealthStatus = "operational" | "degraded" | "down";
type HealthCheckKey = "edge" | "auth" | "database" | "storage" | "notifications";

type HealthCheck = {
  key: HealthCheckKey;
  label: string;
  status: HealthStatus;
  message: string;
  latency_ms: number;
};

const ALLOWED_ROLES = new Set(["admin", "chairman", "manager"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function elapsedSince(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Health check timed out")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function safeFailureMessage(key: HealthCheckKey) {
  const messages: Record<HealthCheckKey, string> = {
    edge: "تعذرت استجابة خدمة الفحص.",
    auth: "تعذر التحقق من جلسة المسؤول.",
    database: "تعذر الاتصال بقاعدة البيانات.",
    storage: "تعذر الوصول إلى خدمة التخزين.",
    notifications: "تعذر التحقق من إعدادات الإشعارات.",
  };
  return messages[key];
}

async function runCheck(
  key: HealthCheckKey,
  label: string,
  task: () => Promise<{ message: string; status?: HealthStatus }>,
  degradedAfterMs = 2500,
): Promise<HealthCheck> {
  const startedAt = performance.now();
  try {
    const result = await withTimeout(task());
    const latency = elapsedSince(startedAt);
    return {
      key,
      label,
      status: result.status || (latency > degradedAfterMs ? "degraded" : "operational"),
      message:
        latency > degradedAfterMs && !result.status
          ? `${result.message} توجد استجابة أبطأ من المعتاد.`
          : result.message,
      latency_ms: latency,
    };
  } catch (error) {
    console.error(`[system-health] ${key} check failed`, error);
    return {
      key,
      label,
      status: "down",
      message: safeFailureMessage(key),
      latency_ms: elapsedSince(startedAt),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const requestStartedAt = performance.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("[system-health] Missing required Supabase environment variables");
      return json({ success: false, error: "تعذر تهيئة خدمة الفحص." }, 500);
    }

    if (!authorization.startsWith("Bearer ")) {
      return json({ success: false, error: "يجب تسجيل الدخول أولاً." }, 401);
    }

    const authStartedAt = performance.now();
    const accessToken = authorization.slice("Bearer ".length).trim();
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return json({ success: false, error: "انتهت الجلسة أو تعذر التحقق منها." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: roleRows, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id);

    if (roleError) {
      console.error("[system-health] Role lookup failed", roleError);
      return json({ success: false, error: "تعذر التحقق من صلاحية الإدارة." }, 500);
    }

    const roles = (roleRows || []).map((row: { role: string }) => row.role);
    if (!roles.some((role: string) => ALLOWED_ROLES.has(role))) {
      return json({ success: false, error: "لا تملك صلاحية عرض حالة النظام." }, 403);
    }

    const authLatency = elapsedSince(authStartedAt);
    const edgeLatency = Math.max(1, elapsedSince(requestStartedAt));
    const baseChecks: HealthCheck[] = [
      {
        key: "edge",
        label: "خدمة الخادم",
        status: edgeLatency > 2500 ? "degraded" : "operational",
        message:
          edgeLatency > 2500
            ? "خدمة الفحص استجابت، لكن بزمن أبطأ من المعتاد."
            : "خدمة الفحص استجابت بصورة طبيعية.",
        latency_ms: edgeLatency,
      },
      {
        key: "auth",
        label: "تسجيل الدخول والصلاحيات",
        status: authLatency > 2500 ? "degraded" : "operational",
        message:
          authLatency > 2500
            ? "تم التحقق من الجلسة، لكن الاستجابة أبطأ من المعتاد."
            : "تم التحقق من الجلسة والصلاحيات بنجاح.",
        latency_ms: authLatency,
      },
    ];

    const [database, storage, notifications] = await Promise.all([
      runCheck("database", "قاعدة البيانات", async () => {
        const { error } = await admin
          .from("profiles")
          .select("id", { count: "exact", head: true });
        if (error) throw error;
        return { message: "الاتصال بقاعدة البيانات يعمل بصورة طبيعية." };
      }),
      runCheck("storage", "الملفات والتخزين", async () => {
        const { data, error } = await admin.storage.listBuckets();
        if (error) throw error;
        return {
          message: `خدمة التخزين متاحة (${data?.length || 0} حاويات مهيأة).`,
        };
      }),
      runCheck("notifications", "إعدادات الإشعارات", async () => {
        const rawServiceAccount = Deno.env.get("FCM_SERVICE_ACCOUNT");
        if (!rawServiceAccount) {
          return {
            status: "degraded",
            message: "إعداد Firebase غير موجود؛ قد تتوقف الإشعارات الخارجية.",
          };
        }

        let serviceAccount: Record<string, unknown>;
        try {
          serviceAccount = JSON.parse(rawServiceAccount.trim());
        } catch {
          return {
            status: "degraded",
            message: "إعداد Firebase موجود لكنه ليس بصيغة صحيحة.",
          };
        }

        if (
          !serviceAccount.project_id ||
          !serviceAccount.client_email ||
          !serviceAccount.private_key
        ) {
          return {
            status: "degraded",
            message: "إعداد Firebase غير مكتمل؛ راجع بيانات الحساب الخدمي.",
          };
        }

        const { count, error } = await admin
          .from("push_tokens")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true);
        if (error) throw error;

        return {
          message: `إعداد الإشعارات سليم، ويوجد ${count || 0} أجهزة مسجلة نشطة.`,
        };
      }),
    ]);

    const checks = [...baseChecks, database, storage, notifications];
    const criticalDown = checks.some(
      (check) => ["edge", "auth", "database"].includes(check.key) && check.status === "down",
    );
    const hasIssue = checks.some((check) => check.status !== "operational");
    const overall: HealthStatus = criticalDown ? "down" : hasIssue ? "degraded" : "operational";

    return json({
      success: true,
      overall,
      checked_at: new Date().toISOString(),
      duration_ms: elapsedSince(requestStartedAt),
      checks,
    });
  } catch (error) {
    console.error("[system-health] Unexpected failure", error);
    return json({ success: false, error: "تعذر إكمال فحص حالة النظام." }, 500);
  }
});
