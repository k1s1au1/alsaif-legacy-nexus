import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type OauthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

const oauthApi = () => (supabase.auth as unknown as { oauth: OauthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground" dir="rtl">
      <p className="text-sm font-bold">
        تعذّر تحميل طلب الربط: {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as any;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "التطبيق الخارجي";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message ?? "تعذّر إكمال الطلب");
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("لم يُرجع الخادم رابط إعادة التوجيه.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground"
      dir="rtl"
    >
      <div className="card-surface w-full max-w-md p-8 space-y-6 text-center">
        <h1 className="text-xl font-black text-primary">ربط {clientName} بحسابك</h1>
        <p className="text-sm font-bold text-muted-foreground leading-relaxed">
          سيتمكن {clientName} من الوصول إلى بيانات المجلس بصلاحياتك أنت فقط، ويمكنك إلغاء الربط في أي
          وقت.
        </p>
        {error && (
          <p role="alert" className="text-xs font-bold text-rose-500">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 h-12 rounded-2xl bg-primary text-white font-black text-sm disabled:opacity-60"
          >
            موافقة
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 h-12 rounded-2xl bg-muted text-foreground font-black text-sm disabled:opacity-60"
          >
            رفض
          </button>
        </div>
      </div>
    </main>
  );
}
