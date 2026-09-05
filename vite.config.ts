// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * Temporary source-level repair for the admin route.
 *
 * A recent generated edit placed a useEffect after the route's loading early-return.
 * On the first render React saw fewer hooks than on the loaded render, which crashes
 * the whole /admin route with "Rendered more hooks than during the previous render".
 *
 * The transform removes that misplaced effect and reinserts an equivalent permission
 * guard before the early-return so hook order stays stable while preserving the role
 * restrictions introduced by the same edit.
 */
const adminHookOrderRuntimeFix = {
  name: "alsaif-admin-hook-order-runtime-fix",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    const cleanId = id.split("?")[0].replace(/\\/g, "/");
    if (!cleanId.endsWith("/src/routes/_authenticated/admin.tsx")) return null;

    const misplacedEffect = `
  // Keep the selected tab within the sections this user is actually allowed to open.
  useEffect(() => {
    if (adminSections.length && !adminSections.some((section) => section.key === tab)) {
      setTab(adminSections[0].key);
    }
  }, [adminSections, tab]);
`;

    const loadingMarker = `  if (loading && !profile.name)\n`;

    if (!code.includes(misplacedEffect) || !code.includes(loadingMarker)) {
      return null;
    }

    const safeTabGuard = `  // Keep the selected tab within the sections this user is actually allowed to open.\n  // This hook must stay before every conditional return to preserve React hook order.\n  useEffect(() => {\n    const allowedTabs: AdminTab[] = [];\n\n    if (isCouncilLeadership) {\n      allowedTabs.push(\n        \"governance\",\n        \"requests\",\n        \"membership_alerts\",\n        \"members\",\n        \"polls\",\n        \"profile_changes\",\n        \"master_archive\",\n        \"suggestions\",\n      );\n    }\n    if (isSiteChairman) allowedTabs.push(\"member_requests\");\n    if (canSeeTechTools) allowedTabs.push(\"bugs\");\n\n    if (allowedTabs.length && !allowedTabs.includes(tab)) {\n      setTab(allowedTabs[0]);\n    }\n  }, [isCouncilLeadership, isSiteChairman, canSeeTechTools, tab]);\n\n`;

    const fixed = code
      .replace(misplacedEffect, "\n")
      .replace(loadingMarker, safeTabGuard + loadingMarker);

    return { code: fixed, map: null };
  },
};

// Alsaif Family Hub - Optimized Config
export default defineConfig({
  vite: {
    plugins: [adminHookOrderRuntimeFix],
  },
  build: {
    rollupOptions: {
      external: ["@capacitor/app", "@capacitor/local-notifications"]
    }
  }
});
