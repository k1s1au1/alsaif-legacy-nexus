import { createClient } from "@supabase/supabase-js";
import { createOfflineFetch } from "@/lib/offline-data";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "placeholder";

const offlineFetch =
  typeof window !== "undefined" ? createOfflineFetch(window.fetch.bind(window), supabaseUrl) : undefined;

// The browser client stores successful read responses in IndexedDB. This lets
// previously opened family data load again when the device has no connection.
export const supabase =
  typeof window !== "undefined"
    ? createClient(supabaseUrl, supabaseAnonKey, {
        global: offlineFetch ? { fetch: offlineFetch } : undefined,
      })
    : ({} as any);

export const getSupabase = () => supabase;

/**
 * getUser validates against the server and therefore cannot succeed offline.
 * Fall back to Supabase's locally stored session only when validation is
 * unavailable, so an already signed-in member can browse cached content.
 */
export async function getCurrentUser() {
  if (typeof window === "undefined") {
    return { data: { user: null }, error: null };
  }

  if (navigator.onLine) {
    try {
      const result = await supabase.auth.getUser();
      if (result.data.user) return result;
    } catch {
      // The local session fallback below is intentional.
    }
  }

  const sessionResult = await supabase.auth.getSession();
  return {
    data: { user: sessionResult.data.session?.user ?? null },
    error: sessionResult.error,
  };
}
