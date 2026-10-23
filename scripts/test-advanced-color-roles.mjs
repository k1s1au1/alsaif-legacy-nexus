import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";

const bundle = await build({
  stdin: {
    contents: `export {THEME_COLORS} from './src/lib/themes';export {balancedDarkTheme} from './src/lib/dark-theme';export {getCustomThemeTokens,applyThemePreference,createCustomThemePreference,parseThemePreference,serializeThemePreference} from './src/lib/theme-preferences';`,
    resolveDir: process.cwd(),
  },
  bundle: true, platform: "node", format: "cjs", write: false, tsconfig: "tsconfig.json",
});
const styles = new Map();
let dark = false;
const root = {
  dataset: {}, classList: { contains: () => dark },
  style: { setProperty: (key, value) => styles.set(key, value), removeProperty: (key) => styles.delete(key) },
  ownerDocument: { querySelector: () => ({ setAttribute() {} }) },
};
const context = { module: { exports: {} }, document: { documentElement: root } };
vm.runInNewContext(bundle.outputFiles[0].text, context);
const { THEME_COLORS, balancedDarkTheme, getCustomThemeTokens, applyThemePreference, createCustomThemePreference, parseThemePreference, serializeThemePreference } = context.module.exports;
const roles = ["textId", "iconId", "backgroundId", "surfaceId", "navigationId", "accentId"];
const core = ["--foreground", "--identity-icon", "--background", "--card", "--nav-bg", "--primary"];
const lightChannels = ["navBg", "primary", "space", "soft", "navBg", "primary"];
const luminance = (color) => color.match(/[a-f0-9]{2}/gi)
  .map((value) => parseInt(value, 16) / 255)
  .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (first, second) => (Math.max(luminance(first), luminance(second)) + 0.05) / (Math.min(luminance(first), luminance(second)) + 0.05);
let combinations = 0;
for (const isDark of [false, true]) {
  const memo = new Map();
  const dependencies = {
    "--foreground": ["textId"], "--muted-foreground": ["textId"],
    "--background": ["backgroundId"], "--card": ["surfaceId"], "--popover": ["surfaceId"],
    "--navy-base": ["backgroundId"], "--hero-card": ["surfaceId"], "--hero-pill": ["surfaceId"], "--navy-card": ["surfaceId"],
    "--hero-logo-badge": ["navigationId"], "--gold-soft": ["accentId"],
    "--nav-bg": ["navigationId"],
    "--identity-icon": isDark ? ["iconId", "surfaceId", "navigationId"] : ["iconId"],
    "--primary": isDark ? ["accentId", "backgroundId", "surfaceId", "navigationId"] : ["accentId"],
    "--identity-icon-foreground": isDark ? ["iconId", "surfaceId", "navigationId"] : ["iconId"],
    "--primary-foreground": isDark ? ["accentId", "backgroundId", "surfaceId", "navigationId"] : ["accentId"],
    "--identity-text-on-nav": ["textId", "navigationId"],
    "--identity-icon-on-nav": isDark ? ["iconId", "surfaceId", "navigationId"] : ["iconId", "navigationId"],
  };
  const selected = Array(roles.length).fill(THEME_COLORS[0]);
  const check = () => {
    const preference = { ...createCustomThemePreference(), ...Object.fromEntries(roles.map((role, index) => [role, selected[index].id])) };
    const tokens = getCustomThemeTokens(preference, isDark);
    const darkPalette = isDark ? balancedDarkTheme({ text: selected[0], icons: selected[1], background: selected[2], surfaces: selected[3], navigation: selected[4], accent: selected[5] }) : null;
    for (const [token, owners] of Object.entries(dependencies)) {
      const key = `${token}/${owners.map((role) => preference[role]).join("/")}`;
      if (memo.has(key)) assert.equal(tokens[token], memo.get(key), `${token} must not borrow an unrelated role's color`);
      else memo.set(key, tokens[token]);
    }
    core.forEach((token, index) => {
      const expected = selected[index].id === "family-ivory" ? "#F5F1E8" : isDark ? darkPalette[token] : selected[index][lightChannels[index]];
      assert.equal(tokens[token], expected, `${roles[index]} uses its own selected palette and the appropriate light/dark shade`);
    });
    for (const [ink, background, minimum] of [
      ["--identity-icon-foreground", "--identity-icon", 4.5],
      ["--primary-foreground", "--primary", 4.5],
      ["--identity-text-on-nav", "--nav-bg", 4.5],
      ["--identity-icon-on-nav", "--nav-bg", 3],
      ["--identity-icon-on-accent", "--primary", 3],
    ]) assert.ok(contrast(tokens[ink], tokens[background]) >= minimum, `${ink} is readable on its own ${background}`);
    const stored = serializeThemePreference(preference);
    assert.equal(serializeThemePreference(parseThemePreference(stored)), stored, "Every mixed selection survives account serialization");
    combinations++;
  };
  const visit = (index) => {
    if (index === roles.length) return check();
    for (const theme of THEME_COLORS) { selected[index] = theme; visit(index + 1); }
  };
  visit(0);
}

const snapshot = () => JSON.stringify([...styles].sort(([a], [b]) => a.localeCompare(b)));
let restorations = 0;
for (const isDark of [false, true]) {
  dark = isDark;
  for (const theme of THEME_COLORS) {
    const preset = { mode: "preset", presetId: theme.id };
    applyThemePreference(preset);
    const baseline = snapshot();
    for (const role of roles) for (const color of THEME_COLORS) {
      applyThemePreference({ ...createCustomThemePreference(theme.id), [role]: color.id });
      applyThemePreference(preset);
      assert.equal(snapshot(), baseline, "Restoring a preset clears every prior custom role override");
      restorations++;
    }
  }
}
console.log(`PASS ${combinations} advanced color combinations, independent role ownership, readable navigation/buttons/filled icons, account round-trips and ${restorations} preset restorations`);
