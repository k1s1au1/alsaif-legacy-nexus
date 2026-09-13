import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/integrations/supabase/client";
import { TermsGate } from "@/components/terms-gate";
import { AlertCircle, Home, RefreshCcw } from "lucide-react";
import { AppShellLayout } from "@/components/app-shell";
import { LegacyExperienceEnhancer } from "@/components/legacy-experience-enhancer";
import { LegacyMiniMapRepair } from "@/components/legacy-minimap-repair";
import { OfflineRouteWarmup } from "@/components/offline-route-warmup";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  errorComponent: ({ error, reset }) => {
    console.error("Route error:", error);
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="card-surface max-w-md w-full p-10 text-center space-y-6 shadow-2xl border-rose-500/20">
          <div className="size-20 rounded-[32px] bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto">
            <AlertCircle size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-primary tracking-tight">حدث خطأ في النظام</h2>
            <p className="text-sm font-bold text-muted-foreground opacity-60 leading-relaxed">
              أعتذر منك، يبدو أن هناك مشكلة في تحميل البيانات. يمكنك المحاولة مرة أخرى أو العودة
              للرئيسية.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-muted/50 text-xs font-bold text-muted-foreground text-center">
            حدث خطأ غير متوقع، يرجى المحاولة مجدداً.
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => reset()}
              className="flex-1 h-14 rounded-2xl bg-primary text-white font-black text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all"
            >
              <RefreshCcw size={18} /> إعادة المحاولة
            </button>
            <a
              href="/"
              className="size-14 rounded-2xl bg-muted flex items-center justify-center text-primary hover:bg-border transition-all"
            >
              <Home size={20} />
            </a>
          </div>
        </div>
      </div>
    );
  },
  beforeLoad: async () => {
    try {
      const { data, error } = await getCurrentUser();
      if (error || !data.user) throw redirect({ to: "/auth" });

      // Accepted members enter directly; profile completion is not an access requirement.
      return { user: data.user };
    } catch (e) {
      // Re-throw redirects so the router handles them
      if (typeof e === "object" && e !== null && ("to" in e || "status" in e)) {
        throw e;
      }
      console.error("Auth guard error:", e);
      // Fallback: allow access if we have a user at least
      const { data } = await getCurrentUser();
      if (data?.user) return { user: data.user };
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <TermsGate>
      <AppShellLayout>
        <OfflineRouteWarmup />
        <LegacyExperienceEnhancer />
        <LegacyMiniMapRepair />
        <Outlet />
      </AppShellLayout>
    </TermsGate>
  ),
});
