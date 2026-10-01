import { THEME_COLORS, applyThemeColors } from "@/lib/themes";

export const DEFAULT_THEME_COLOR_ID = "emerald";
export const CUSTOM_THEME_PREFIX = "custom:";

export type ThemeColorId = (typeof THEME_COLORS)[number]["id"];

export type PresetThemePreference = {
  mode: "preset";
  presetId: ThemeColorId;
};

export type CustomThemePreference = {
  mode: "custom";
  baseId: ThemeColorId;
  textId: ThemeColorId;
  iconId: ThemeColorId;
  backgroundId: ThemeColorId;
  surfaceId: ThemeColorId;
  navigationId: ThemeColorId;
  accentId: ThemeColorId;
};

export type ThemePreference = PresetThemePreference | CustomThemePreference;

type StoredCustomThemePreference = {
  v: 1;
  base: ThemeColorId;
  text: ThemeColorId;
  icons: ThemeColorId;
  background: ThemeColorId;
  surfaces: ThemeColorId;
  navigation: ThemeColorId;
  accent: ThemeColorId;
};

const customStyleProperties = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--identity-text-on-nav",
  "--identity-icon",
  "--identity-icon-on-nav",
] as const;

const themeIds = new Set(THEME_COLORS.map((theme) => theme.id));

function isThemeColorId(value: unknown): boolean {
  return typeof value === "string" && themeIds.has(value);
}

export function getThemeColor(themeId: string | null | undefined) {
  return THEME_COLORS.find((theme) => theme.id === themeId) || THEME_COLORS[0];
}

export function createPresetThemePreference(
  presetId: string = DEFAULT_THEME_COLOR_ID,
): PresetThemePreference {
  return {
    mode: "preset",
    presetId: getThemeColor(presetId).id,
  };
}

export function createCustomThemePreference(
  baseId: string = DEFAULT_THEME_COLOR_ID,
): CustomThemePreference {
  const validBaseId = getThemeColor(baseId).id;
  return {
    mode: "custom",
    baseId: validBaseId,
    textId: validBaseId,
    iconId: validBaseId,
    backgroundId: validBaseId,
    surfaceId: validBaseId,
    navigationId: validBaseId,
    accentId: validBaseId,
  };
}

export function getThemePreferenceBaseId(preference: ThemePreference): ThemeColorId {
  return preference.mode === "custom" ? preference.baseId : preference.presetId;
}

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  if (!value) return createPresetThemePreference();
  if (isThemeColorId(value)) return createPresetThemePreference(value);
  if (!value.startsWith(CUSTOM_THEME_PREFIX)) return createPresetThemePreference();

  try {
    const stored = JSON.parse(
      value.slice(CUSTOM_THEME_PREFIX.length),
    ) as Partial<StoredCustomThemePreference>;
    const ids = [
      stored.base,
      stored.text,
      stored.icons,
      stored.background,
      stored.surfaces,
      stored.navigation,
      stored.accent,
    ];

    if (stored.v !== 1 || !ids.every(isThemeColorId)) {
      return createPresetThemePreference();
    }

    return {
      mode: "custom",
      baseId: stored.base!,
      textId: stored.text!,
      iconId: stored.icons!,
      backgroundId: stored.background!,
      surfaceId: stored.surfaces!,
      navigationId: stored.navigation!,
      accentId: stored.accent!,
    };
  } catch {
    return createPresetThemePreference();
  }
}

export function serializeThemePreference(preference: ThemePreference): string {
  if (preference.mode === "preset") return preference.presetId;

  const stored: StoredCustomThemePreference = {
    v: 1,
    base: preference.baseId,
    text: preference.textId,
    icons: preference.iconId,
    background: preference.backgroundId,
    surfaces: preference.surfaceId,
    navigation: preference.navigationId,
    accent: preference.accentId,
  };

  return `${CUSTOM_THEME_PREFIX}${JSON.stringify(stored)}`;
}

function clearCustomThemeProperties(root: HTMLElement) {
  customStyleProperties.forEach((property) => root.style.removeProperty(property));
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const baseTheme = getThemeColor(getThemePreferenceBaseId(preference));
  clearCustomThemeProperties(root);
  applyThemeColors(baseTheme);
  root.dataset.themeColorBase = baseTheme.id;

  if (preference.mode === "preset") {
    root.dataset.themeColorMode = "preset";
    return;
  }

  const isDark = root.classList.contains("dark");
  const textTheme = getThemeColor(preference.textId);
  const iconTheme = getThemeColor(preference.iconId);
  const backgroundTheme = getThemeColor(preference.backgroundId);
  const surfaceTheme = getThemeColor(preference.surfaceId);
  const navigationTheme = getThemeColor(preference.navigationId);
  const accentTheme = getThemeColor(preference.accentId);

  const text = isDark ? textTheme.darkSecondary : textTheme.navBg;
  const mutedText = isDark ? textTheme.darkSecondary : textTheme.primary;
  const textOnNavigation = isDark ? textTheme.darkSecondary : textTheme.tertiary;
  const icon = isDark ? iconTheme.darkSecondary : iconTheme.primary;
  const iconOnNavigation = isDark ? iconTheme.darkSecondary : iconTheme.tertiary;
  const background = isDark ? backgroundTheme.darkSpace : backgroundTheme.space;
  const surface = isDark ? surfaceTheme.darkSoft : surfaceTheme.soft;
  const mutedSurface = isDark ? surfaceTheme.darkPanel : surfaceTheme.space;
  const navigation = isDark ? navigationTheme.darkNavBg : navigationTheme.navBg;
  const primary = isDark ? accentTheme.darkPrimary : accentTheme.primary;
  const accent = isDark ? accentTheme.darkSecondary : accentTheme.secondary;

  root.style.setProperty("--foreground", text);
  root.style.setProperty("--card-foreground", text);
  root.style.setProperty("--popover-foreground", text);
  root.style.setProperty("--secondary-foreground", text);
  root.style.setProperty("--muted-foreground", mutedText);
  root.style.setProperty("--identity-text", text);
  root.style.setProperty("--identity-text-on-nav", textOnNavigation);

  root.style.setProperty("--identity-icon", icon);
  root.style.setProperty("--identity-icon-on-nav", iconOnNavigation);

  root.style.setProperty("--background", background);
  root.style.setProperty("--identity-space", background);

  root.style.setProperty("--card", surface);
  root.style.setProperty("--popover", surface);
  root.style.setProperty("--secondary", mutedSurface);
  root.style.setProperty("--muted", mutedSurface);
  root.style.setProperty("--accent", mutedSurface);
  root.style.setProperty("--accent-foreground", text);
  root.style.setProperty("--identity-soft", surface);
  root.style.setProperty("--identity-panel", isDark ? surfaceTheme.darkPanel : surfaceTheme.panel);

  root.style.setProperty("--nav-bg", navigation);
  root.style.setProperty("--identity-header", navigation);

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--primary-foreground", accentTheme.foreground);
  root.style.setProperty("--gold-primary", accent);
  root.style.setProperty("--identity-accent", accent);
  root.style.setProperty("--identity-tertiary", accentTheme.tertiary);

  root.dataset.themeColorMode = "custom";
}
