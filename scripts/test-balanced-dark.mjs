import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const bundle = await build({
  stdin: {
    contents: `export {balancedDarkTheme} from './src/lib/dark-theme';export {THEME_COLORS} from './src/lib/themes';export {applyThemePreference,createCustomThemePreference} from './src/lib/theme-preferences';export {APPEARANCE_BOOTSTRAP} from './src/lib/appearance';`,
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
