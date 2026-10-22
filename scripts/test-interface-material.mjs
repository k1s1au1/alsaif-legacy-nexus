import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";

const bundle = await build({
  stdin: {
    contents: `export * from './src/lib/theme-preferences';export {THEME_COLORS} from './src/lib/themes';export {APPEARANCE_BOOTSTRAP} from './src/lib/appearance';`,
    resolveDir: process.cwd(),
  },
  bundle: true, platform: "node", format: "cjs", write: false, tsconfig: "tsconfig.json",
});
const properties = new Map();
let dark = false;
const root = {
  dataset: {}, classList: { contains: () => dark },
  style: { setProperty: (k, v) => properties.set(k, v), removeProperty: (k) => properties.delete(k) },
  ownerDocument: { querySelector: () => ({ setAttribute() {} }) },
};
const context = { module: { exports: {} }, document: { documentElement: root } };
vm.runInNewContext(bundle.outputFiles[0].text, context);
const { THEME_COLORS, createCustomThemePreference, parseThemePreference, serializeThemePreference, applyThemePreference, APPEARANCE_BOOTSTRAP, CUSTOM_ROLE_PROPERTIES } = context.module.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
for (const theme of THEME_COLORS) {
  assert.equal(serializeThemePreference({ mode: "preset", presetId: theme.id }), theme.id);
  assert.equal(parseThemePreference(theme.id).material, undefined, "Existing users stay classic");
  for (const preference of [
    { mode: "preset", presetId: theme.id },
    { ...createCustomThemePreference(theme.id), textId: "royal-copper", iconId: "family-ivory", navigationId: "heritage-maroon", accentId: "royal-gold" },
  ]) {
    const crystal = { ...preference, material: "crystal" };
    const stored = serializeThemePreference(crystal);
    assert.deepEqual(plain(parseThemePreference(stored)), crystal, "Account value retains every color role and the crystal material");
    assert.deepEqual(plain(parseThemePreference(serializeThemePreference({ ...crystal, material: "classic" }))), preference, "Returning to classic restores the legacy-compatible color value");
    for (const isDark of [false, true]) {
      dark = isDark;
      applyThemePreference(preference);
      const colors = [...properties].sort(([a], [b]) => a.localeCompare(b));
      applyThemePreference(crystal);
      assert.equal(root.dataset.interfaceMaterial, "crystal");
      assert.deepEqual([...properties].sort(([a], [b]) => a.localeCompare(b)), colors, "Material never changes identity color roles");
      applyThemePreference(preference);
      assert.equal(root.dataset.interfaceMaterial, undefined, "Classic removes the opt-in marker");
    }
    const document = { documentElement: { dataset: {}, classList: { toggle() {} } } };
    vm.runInNewContext(APPEARANCE_BOOTSTRAP, { document, localStorage: { getItem: (key) => key === "app-theme-color-id" ? stored : null } });
    assert.equal(document.documentElement.dataset.interfaceMaterial, "crystal", "Saved material is restored before paint");
  }
}
for (const value of [null, "", "unknown", "appearance:{", 'appearance:{"v":2,"material":"crystal","color":"emerald"}', 'appearance:{"v":1,"material":"other","color":"emerald"}', 'appearance:{"v":1,"material":"crystal","color":"unknown"}', 'appearance:{"v":1,"material":"crystal","color":"appearance:bad"}']) {
  assert.equal(parseThemePreference(value).material, undefined, "Invalid saved values fall back to classic");
}
assert.equal(Object.keys(CUSTOM_ROLE_PROPERTIES).length, 6, "Material is separate from the six advanced color roles");
console.log("PASS optional crystal: seven identities, six advanced roles, light/dark, account round trips, classic defaults and pre-paint restoration");
