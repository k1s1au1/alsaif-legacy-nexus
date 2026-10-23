import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const bundle = await build({
  stdin: {
    contents: `export {balancedDarkTheme} from './src/lib/dark-theme';export {THEME_COLORS} from './src/lib/themes';export {applyThemePreference,createCustomThemePreference,getCustomRoleSwatch,parseThemePreference,serializeThemePreference,CUSTOM_ROLE_PROPERTIES} from './src/lib/theme-preferences';export {APPEARANCE_BOOTSTRAP} from './src/lib/appearance';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  tsconfig: "tsconfig.json",
});
const properties = new Map();
let dark = true;
let themeColor;
const root = {
  dataset: {},
  classList: { contains: () => dark },
  style: {
    setProperty: (k, v) => properties.set(k, v),
    removeProperty: (k) => properties.delete(k),
  },
  ownerDocument: {
    querySelector: () => ({
      setAttribute: (_, value) => {
        themeColor = value;
      },
    }),
  },
};
const context = { module: { exports: {} }, document: { documentElement: root } };
vm.runInNewContext(bundle.outputFiles[0].text, context);
const {
  THEME_COLORS,
  balancedDarkTheme,
  applyThemePreference,
  createCustomThemePreference,
  getCustomRoleSwatch,
  parseThemePreference,
  serializeThemePreference,
  CUSTOM_ROLE_PROPERTIES,
  APPEARANCE_BOOTSTRAP,
} = context.module.exports;
const luminance = (hex) =>
  hex
    .match(/[a-f0-9]{2}/gi)
    .map((n) => parseInt(n, 16) / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
    .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
let combinations = 0;
for (const foreground of THEME_COLORS)
  for (const surface of THEME_COLORS)
    for (const navigation of THEME_COLORS) {
      const tokens = balancedDarkTheme({
        text: foreground,
        icons: foreground,
        accent: foreground,
        background: navigation,
        surfaces: surface,
        navigation,
      });
      for (const background of ["--background", "--card", "--popover", "--nav-bg"]) {
        assert.ok(
          luminance(tokens[background]) < 0.08,
          "Every identity keeps genuinely dark surfaces",
        );
        for (const ink of ["--foreground", "--muted-foreground", "--primary"])
          assert.ok(
            contrast(tokens[ink], tokens[background]) >= 4.5,
            `${foreground.id}/${surface.id}/${navigation.id}: ${ink} readable on ${background}`,
          );
        assert.ok(
          contrast(tokens["--input"], tokens[background]) >= 3,
          "Field outlines remain distinguishable",
        );
      }
      assert.ok(
        contrast(tokens["--primary"], tokens["--primary-foreground"]) >= 4.5,
        "Accent button labels remain readable",
      );
      assert.notEqual(
        tokens["--foreground"],
        tokens["--muted-foreground"],
        "Primary and secondary text stay distinct",
      );
      assert.ok(
        luminance(tokens["--background"]) < luminance(tokens["--card"]),
        "Cards are lighter than the page",
      );
      assert.ok(
        luminance(tokens["--card"]) < luminance(tokens["--popover"]),
        "Raised surfaces stay above cards",
      );
      combinations++;
    }
for (const theme of THEME_COLORS) {
  dark = true;
  applyThemePreference({ mode: "preset", presetId: theme.id });
  assert.equal(properties.get("--foreground"), properties.get("--identity-text"));
  assert.equal(themeColor, properties.get("--nav-bg"));
  dark = false;
  applyThemePreference({ mode: "preset", presetId: theme.id });
  assert.equal(properties.get("--primary"), theme.primary, "Light accent restored");
  assert.equal(properties.get("--identity-space"), theme.space, "Light identity restored");
  assert.equal(properties.has("--card"), false, "Dark inline card colors removed on light mode");
  assert.equal(properties.has("--foreground"), false, "Dark text overrides removed on light mode");
}
const custom = {
  ...createCustomThemePreference(),
  textId: "royal-gold",
  iconId: "royal-copper",
  backgroundId: "midnight",
  surfaceId: "muted-palm",
  navigationId: "heritage-maroon",
  accentId: "emerald",
};
dark = true;
applyThemePreference(custom);
const selected = (id) => THEME_COLORS.find((t) => t.id === id);
const expected = balancedDarkTheme({
  text: selected(custom.textId),
  icons: selected(custom.iconId),
  background: selected(custom.backgroundId),
  surfaces: selected(custom.surfaceId),
  navigation: selected(custom.navigationId),
  accent: selected(custom.accentId),
});
for (const [name, value] of Object.entries(expected))
  assert.equal(properties.get(name), value, `Custom role retained: ${name}`);
dark = false;
applyThemePreference(custom);
assert.equal(properties.get("--background"), selected(custom.backgroundId).space);
assert.equal(properties.get("--foreground"), selected(custom.textId).navBg);
assert.equal(properties.get("--card"), selected(custom.surfaceId).soft);
assert.equal(properties.has("--input"), false, "Dark field border removed in custom light mode");
for (const isDark of [false, true]) {
  dark = isDark;
  applyThemePreference(createCustomThemePreference());
  const originalIconForeground = properties.get("--identity-icon-foreground");
  for (const [role, property] of Object.entries(CUSTOM_ROLE_PROPERTIES)) {
    const draft = { ...createCustomThemePreference(), [role]: "family-ivory" };
    const restored = parseThemePreference(serializeThemePreference(draft));
    assert.equal(restored[role], "family-ivory", `${role}: saved ivory choice restored`);
    assert.equal(
      getCustomRoleSwatch("family-ivory", role, isDark),
      "#F5F1E8",
      `${role}: swatch shows the actual services ivory`,
    );
    applyThemePreference(restored);
    assert.equal(
      properties.get(property),
      "#F5F1E8",
      `${role}: applied color matches the displayed swatch`,
    );
    if (role === "accentId")
      assert.ok(
        contrast(properties.get("--primary"), properties.get("--primary-foreground")) >= 4.5,
        "Ivory buttons retain readable labels",
      );
    if (role === "navigationId")
      assert.ok(
        contrast(properties.get("--nav-bg"), properties.get("--identity-text-on-nav")) >= 4.5,
        "Ivory bars retain readable labels",
      );
    applyThemePreference(createCustomThemePreference());
    assert.notEqual(
      properties.get(property),
      "#F5F1E8",
      `${role}: cancelling restores the saved account color`,
    );
    assert.equal(
      properties.get("--identity-icon-foreground"),
      originalIconForeground,
      "Restoring a saved identity restores its own icon labels",
    );
  }
}
const ivoryBase = createCustomThemePreference("family-ivory");
// Existing accounts keep their identity colors after the old appearance wrapper is retired.
for (const color of [...THEME_COLORS.map((theme) => theme.id), serializeThemePreference(custom)]) {
  const legacy = `appearance:${JSON.stringify({ v: 1, material: "crystal", color })}`;
  const restored = parseThemePreference(legacy);
  assert.equal(serializeThemePreference(restored), color, "Legacy account colors survive migration");
  assert.equal("material" in restored, false, "Retired material is discarded");
  dark = false;
  applyThemePreference(parseThemePreference(color));
  const before = JSON.stringify([...properties]);
  applyThemePreference(restored);
  assert.equal(JSON.stringify([...properties]), before, "Restored colors match the original identity");
}
for (const value of ["appearance:broken", "appearance:null", 'appearance:{"v":1}', 'appearance:{"v":2,"color":"midnight"}', `appearance:${JSON.stringify({ v: 1, color: 'appearance:{"v":1,"color":"midnight"}' })}`]) {
  assert.equal(serializeThemePreference(parseThemePreference(value)), "emerald", "Invalid legacy data falls back safely");
}
assert.equal(ivoryBase.textId, "emerald", "Starting from the ivory preset keeps its readable ink");
assert.equal(
  ivoryBase.backgroundId,
  "family-ivory",
  "Starting from the ivory preset retains its background",
);
for (const saved of ["dark", "light", "system", null])
  for (const osDark of [true, false]) {
    let active = false;
    vm.runInNewContext(APPEARANCE_BOOTSTRAP, {
      localStorage: { getItem: () => saved },
      window: { matchMedia: () => ({ matches: osDark }) },
      document: {
        documentElement: {
          classList: {
            toggle: (_, value) => {
              active = value;
            },
          },
        },
      },
    });
    assert.equal(
      active,
      saved === "dark" || (saved === "system" && osDark),
      "Saved mode restored before paint; no preference preserves the web default",
    );
  }
const settings = readFileSync("src/routes/_authenticated/settings.tsx", "utf8");
assert.ok(settings.includes("Opening settings must not mutate the active theme"));
console.log(
  `PASS ${combinations} dark identity combinations: text/controls contrast, surface hierarchy, independent custom roles, light restoration and saved appearance`,
);
