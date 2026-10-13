import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Delivery, Message } from "@/lib/chat";

export const CHAT_READ_EVENT = "chat:read-confirmed";

type ReadState = {
  readAt: string | null;
  receiptIds: Set<string>;
  queue: Promise<void>;
};
const readStates = new Map<string, ReadState>();

/** Preserve Postgres sub-millisecond precision when two messages arrive together. */
export function compareChatTime(left?: string | null, right?: string | null) {
  const a = Date.parse(left ?? "");
  const b = Date.parse(right ?? "");
  const am = Number.isFinite(a) ? a : -Infinity;
  const bm = Number.isFinite(b) ? b : -Infinity;
  if (am !== bm) return am > bm ? 1 : -1;
  if (!Number.isFinite(am)) return 0;
  const fraction = (value: string) =>
    Number((value.match(/\.(\d+)/)?.[1] ?? "").padEnd(9, "0").slice(3, 9));
  return Math.sign(fraction(left!) - fraction(right!));
}

function readState(userId: string, conversationId: string) {
  const key = `${userId}:${conversationId}`;
  let state = readStates.get(key);
  if (!state) {
    state = { readAt: null, receiptIds: new Set(), queue: Promise.resolve() };
    readStates.set(key, state);
  }
  return state;
}

export function effectiveLastReadAt(
  userId: string,
  conversationId: string,
  persisted?: string | null,
) {
  const confirmed = readStates.get(`${userId}:${conversationId}`)?.readAt;
  return compareChatTime(confirmed, persisted) > 0 ? confirmed : persisted;
}

export function isUnreadChatMessage(
  message: Message,
  userId: string,
  persisted?: string | null,
) {
  return message.sender_id !== userId &&
    compareChatTime(message.created_at, effectiveLastReadAt(userId, message.conversation_id, persisted)) > 0;
}

export async function markConversationRead(
  client: SupabaseClient<Database>,
  userId: string,
  conversationId: string,
  messages: Message[],
  deliveries: Delivery[] = [],
) {
  // Capture only messages already displayed in this conversation. Never use "now"
  // as the badge cursor: messages arriving during the write must stay unread.
  const visible = messages.filter((m) =>
    m.conversation_id === conversationId && Number.isFinite(Date.parse(m.created_at)),
  );
  const readAt = visible.reduce<string | null>(
    (latest, m) => compareChatTime(m.created_at, latest) > 0 ? m.created_at : latest,
    null,
  );
  if (!readAt) return;
  const state = readState(userId, conversationId);
  deliveries.forEach((d) => {
    if (d.user_id === userId && d.conversation_id === conversationId && d.read_at) {
      state.receiptIds.add(d.message_id);
    }
  });

  const job = state.queue.then(async () => {
    if (compareChatTime(readAt, state.readAt) > 0) {
      const update = await client
        .from("conversation_participants")
        .update({ last_read_at: readAt })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .or(`last_read_at.is.null,last_read_at.lt.${readAt}`)
        .select("last_read_at")
        .maybeSingle();
      if (update.error) throw update.error;
      // Another device may have advanced the cursor already. Verify that row
      // rather than moving its cursor backwards or acknowledging a denied write.
      let row = update.data;
      if (!row) {
        const current = await client
          .from("conversation_participants")
          .select("last_read_at")
          .eq("conversation_id", conversationId)
          .eq("user_id", userId)
          .maybeSingle();
        if (current.error) throw current.error;
        row = current.data;
      }
      if (!row || compareChatTime(row.last_read_at, readAt) < 0) {
        throw new Error("تعذر تسجيل قراءة المحادثة");
      }
      state.readAt = row.last_read_at;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CHAT_READ_EVENT, {
          detail: { userId, conversationId, readAt: state.readAt },
        }));
      }
    }

    const unread = visible.filter((m) => m.sender_id !== userId && !state.receiptIds.has(m.id));
    if (!unread.length) return;
    const receipt = await client.from("message_deliveries").upsert(
      unread.map((m) => ({
        message_id: m.id,
        conversation_id: conversationId,
        user_id: userId,
        read_at: new Date().toISOString(),
      })),
      { onConflict: "message_id,user_id" },
    );
    if (receipt.error) throw receipt.error;
    unread.forEach((m) => state.receiptIds.add(m.id));
  });
  // Failed receipts remain retryable, and later snapshots are serialized.
  state.queue = job.then(() => {}, () => {});
  await job;
}

export function useConversationRead(
  client: SupabaseClient<Database>,
  userId: string | null,
  conversationId: string,
  messages: Message[],
  deliveries: Delivery[],
  ready: boolean,
) {
  useEffect(() => {
    if (!ready || !userId || !messages.length) return;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const markVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (retry) clearTimeout(retry);
      void markConversationRead(client, userId, conversationId, messages, deliveries).catch(() => {
        if (!disposed) retry = setTimeout(markVisible, 2000);
      });
    };
    markVisible();
    document.addEventListener("visibilitychange", markVisible);
    window.addEventListener("focus", markVisible);
    window.addEventListener("online", markVisible);
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      document.removeEventListener("visibilitychange", markVisible);
      window.removeEventListener("focus", markVisible);
      window.removeEventListener("online", markVisible);
      // A foreground snapshot already observed must still finish if the user goes back.
    };
  }, [client, userId, conversationId, messages, deliveries, ready]);
}
