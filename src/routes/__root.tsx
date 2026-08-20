import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import mobileTabletHeroCss from "../mobile-tablet-hero.css?url";
import mobileTabletFloatingHeaderCss from "../mobile-tablet-floating-header.css?url";
import mobileTabletHubRedesignCss from "../mobile-tablet-hub-redesign.css?url";
import mobileTabletHeritageFixCss from "../mobile-tablet-heritage-fix.css?url";
import mobileTabletIdentityTonesCss from "../mobile-tablet-identity-tones.css?url";
import mobileTabletHeroReferenceFixCss from "../mobile-tablet-hero-reference-fix.css?url";
import desktopDashboardCss from "../desktop-dashboard.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "sonner";
import { THEME_COLORS, applyThemeColors } from "@/lib/themes";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gold-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90">الرئيسية</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm text-muted-foreground">يمكنك المحاولة مرة أخرى أو العودة للصفحة الرئيسية.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">إعادة المحاولة</button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">الرئيسية</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "السيف — Alsaif" },
      { name: "description", content: "السيف — منصة العائلة الخاصة للتواصل والتنظيم وحفظ الإرث. Private family & community headquarters." },
      { name: "theme-color", content: "#0F5A3A" },
      { property: "og:title", content: "السيف — Alsaif" },
      { property: "og:description", content: "نصل العائلة، نحفظ الإرث، نبني المجتمع." },
      { property: "og:type", content: "website" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "السيف" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: mobileTabletHeroCss },
      { rel: "stylesheet", href: mobileTabletFloatingHeaderCss },
      { rel: "stylesheet", href: mobileTabletHubRedesignCss },
      { rel: "stylesheet", href: mobileTabletHeritageFixCss },
      { rel: "stylesheet", href: mobileTabletIdentityTonesCss },
      { rel: "stylesheet", href: mobileTabletHeroReferenceFixCss },
      { rel: "stylesheet", href: desktopDashboardCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/logo-home.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@400;700&family=Reem+Kufi:wght@400;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() { return <Outlet />; }

function RootShell({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = new QueryClient();
  useEffect(() => {
    const syncTheme = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let themeId = localStorage.getItem("theme-color") || "saif-green";
        if (user) {
          const { data } = await supabase.from("profiles").select("theme_color").eq("id", user.id).maybeSingle();
          if (data?.theme_color) themeId = data.theme_color;
        }
        const theme = THEME_COLORS.find((t) => t.id === themeId) || THEME_COLORS[0];
        applyThemeColors(theme);
      } catch (e) { console.warn("Theme sync failed", e); }
    };
    syncTheme();
  }, []);
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster richColors position="top-center" />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
