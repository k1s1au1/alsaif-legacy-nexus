import { createMiddleware } from "@tanstack/react-start";

/**
 * Resolves Supabase connection values on the server.
 * Cloudflare only injects the non-prefixed secrets at request time, while the
 * VITE_* values are inlined at build time — so we check both.
 */
export const resolveSupabaseUrl = () =>
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL;

export const resolveSupabasePublishableKey = () =>
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Admin (service-role) client, or null when the service key is unavailable. */
export const getAdminClient = async () => {
  const url = resolveSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

    const token = authHeader.replace("Bearer ", "");
    const url = resolveSupabaseUrl();
    const anonKey = resolveSupabasePublishableKey();
    if (!url || !anonKey) {
      throw new Error("تعذّر الوصول لإعدادات الخادم، يرجى المحاولة لاحقاً");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) throw new Error("Unauthorized");

    return next({
      context: { userId: data.claims.sub as string, claims: data.claims, token },
    });
  },
);
