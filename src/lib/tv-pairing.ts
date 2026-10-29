/** Public protocol only. Neither QR links nor browser storage carry a login session. */
export type TvPairAction = "start" | "status" | "claim" | "inspect" | "approve" | "deny" | "cancel";
export type TvPairRequest = { id: string; deviceSecret: string; approvalSecret: string; code: string; expiresAt: string };
export const TV_PAIR_TTL_SECONDS = 300;
export const TV_PAIR_POLL_SECONDS = 3;
export const TV_PAIR_STORAGE = "alsaif-tv-approval-v1";
export const isPairId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const isPairSecret = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export function newPairSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function pairingUrl(origin: string, pair: Pick<TvPairRequest, "id" | "approvalSecret">) {
  const url = new URL("/tv-login", origin);
  url.hash = new URLSearchParams({ id: pair.id, key: pair.approvalSecret }).toString();
  return url.href;
}
export function parsePairLink(hash: string): { id: string; approvalSecret: string } | null {
  const values = new URLSearchParams(hash.replace(/^#/, ""));
  const id = values.get("id"), approvalSecret = values.get("key");
  return isPairId(id) && isPairSecret(approvalSecret) ? { id, approvalSecret } : null;
}
export class TvPairError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}
export async function callTvPair(action: TvPairAction, body: Record<string, unknown>, token?: string, signal?: AbortSignal) {
  const response = await fetch("/api/tv-pair", {
    method: "POST", cache: "no-store", credentials: "omit", signal,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new TvPairError(data.error || "تعذّر الاتصال بخدمة دخول التلفزيون", response.status, data.code || "unavailable");
  return data;
}
