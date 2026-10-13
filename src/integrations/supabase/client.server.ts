import type { Database } from "./types";
import {
  resolveSupabasePublishableKey,
  resolveSupabaseUrl,
} from "@/lib/api/supabase-auth.middleware";

// Standard server-side client setup
export const getSupabaseAdmin = async () => {
  const url = resolveSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations will fail.");
    return null;
  }

  // Use dynamic import to avoid serialization issues with Proxy objects
  const { createClient } = await import("@supabase/supabase-js");

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

/**
 * Creates a Supabase client that acts on behalf of a specific user.
 * Useful for operations that should respect RLS but need to run on the server.
 */
export const getSupabaseUserClient = async (token: string) => {
  const url = resolveSupabaseUrl();
  const key = resolveSupabasePublishableKey();

  if (!url || !key) return null;

  const { createClient } = await import("@supabase/supabase-js");

  const client = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  return client;
};
