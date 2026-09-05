const fs = require('fs');

const adminPath = 'src/routes/_authenticated/admin.tsx';
let code = fs.readFileSync(adminPath, 'utf8');

const misplacedEffect = `  // Keep the selected tab within the sections this user is actually allowed to open.
  useEffect(() => {
    if (adminSections.length && !adminSections.some((section) => section.key === tab)) {
      setTab(adminSections[0].key);
    }
  }, [adminSections, tab]);
`;

if (!code.includes(misplacedEffect)) {
  throw new Error('Expected misplaced admin useEffect was not found');
}
code = code.replace(misplacedEffect, '');

const loadingMarker = `  if (loading && !profile.name)\n`;
if (!code.includes(loadingMarker)) {
  throw new Error('Admin loading marker was not found');
}

const safeTabGuard = `  // Keep the selected tab within the sections this user is actually allowed to open.\n  // This hook must stay before every conditional return so React hook order never changes.\n  useEffect(() => {\n    const allowedTabs: AdminTab[] = [];\n\n    if (isCouncilLeadership) {\n      allowedTabs.push(\n        \"governance\",\n        \"requests\",\n        \"membership_alerts\",\n        \"members\",\n        \"polls\",\n        \"profile_changes\",\n        \"master_archive\",\n        \"suggestions\",\n      );\n    }\n    if (isSiteChairman) allowedTabs.push(\"member_requests\");\n    if (canSeeTechTools) allowedTabs.push(\"bugs\");\n\n    if (allowedTabs.length > 0 && !allowedTabs.includes(tab)) {\n      setTab(allowedTabs[0]);\n    }\n  }, [isCouncilLeadership, isSiteChairman, canSeeTechTools, tab]);\n\n`;
code = code.replace(loadingMarker, safeTabGuard + loadingMarker);

const oldActiveSection = `  const activeAdminSection =\n    adminSections.find((section) => section.key === tab) || adminSections[0];\n\n`;
const newActiveSection = `  const activeAdminSection =\n    adminSections.find((section) => section.key === tab) ||\n    adminSections[0] || {\n      key: \"requests\" as AdminTab,\n      label: \"الإدارة\",\n      shortLabel: \"الإدارة\",\n      description: \"لا توجد وحدة إدارية متاحة لهذه الصلاحية.\",\n      icon: Shield,\n      visible: false,\n    };\n  const hasVisibleAdminSection = adminSections.length > 0;\n\n`;
if (!code.includes(oldActiveSection)) {
  throw new Error('Active admin section block was not found');
}
code = code.replace(oldActiveSection, newActiveSection);

const accessGate = `        {!isA ? (`;
if (!code.includes(accessGate)) {
  throw new Error('Admin access gate was not found');
}
code = code.replace(accessGate, `        {!isA || !hasVisibleAdminSection ? (`);

fs.writeFileSync(adminPath, code);

const vite = `// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually\n// or the app will break with duplicate plugins:\n//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),\n//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,\n//     error logger plugins, and sandbox detection (port/host/strictPort).\n// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.\nimport { defineConfig } from \"@lovable.dev/vite-tanstack-config\";\n\n// Alsaif Family Hub - Optimized Config\nexport default defineConfig({\n  build: {\n    rollupOptions: {\n      external: [\"@capacitor/app\", \"@capacitor/local-notifications\"]\n    }\n  }\n});\n`;
fs.writeFileSync('vite.config.ts', vite);
