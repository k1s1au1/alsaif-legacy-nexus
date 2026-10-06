import { supabase } from "@/integrations/supabase/client";

const KEY = "fcm_token";

/** Bind this device's push token to the signed-in account only (unbinds other accounts). */
export async function claimPushToken(token: string, platform: string) {
  try { localStorage.setItem(KEY, token); } catch { /* ignore */ }
  const { error } = await supabase.rpc("claim_push_token" as any, { _token: token, _platform: platform } as any);
  if (error) throw error;
}

/** Call before signOut so this device stops receiving the leaving account's notifications. */
export async function releasePushToken() {
  let token: string | null = null;
  try { token = localStorage.getItem(KEY); } catch { /* ignore */ }
  if (!token) return;
  try {
    await supabase.rpc("release_push_token" as any, { _token: token } as any);
  } catch { /* ignore */ }
}
