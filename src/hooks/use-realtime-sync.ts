import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime INSERT/UPDATE/DELETE events on the given public tables
 * and calls `onChange` (debounced) so every device refreshes instantly when
 * anything is published or deleted in any section.
 */
export function useRealtimeSync(tables: string[], onChange: () => void, enabled = true) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  const key = tables.join("|");

  useEffect(() => {
    if (!enabled || !key) return;
    const list = key.split("|");
    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), 250);
    };

    const channel = supabase.channel(`sync-${list.join("-")}-${Math.random().toString(36).slice(2, 8)}`);
    list.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, trigger);
    });
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key, enabled]);
}
