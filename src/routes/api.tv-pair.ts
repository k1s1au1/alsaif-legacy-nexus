import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tv-pair")({
  server: { handlers: {
    POST: async ({ request }) => {
      const [{ getSupabaseAdmin }, { createTvPairingHandler }] = await Promise.all([
        import("@/integrations/supabase/client.server"), import("@/lib/api/tv-pairing.server"),
      ]);
      return createTvPairingHandler({ admin: await getSupabaseAdmin() })(request);
    },
  } },
});
