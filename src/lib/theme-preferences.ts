import { FAMILY_SERVICES_IVORY, THEME_COLORS, applyThemeColors } from "@/lib/themes";
import { balancedDarkTheme } from "@/lib/dark-theme";

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

export type CustomThemeRole = Exclude<keyof CustomThemePreference, "mode" | "baseId">;

export const CUSTOM_ROLE_PROPERTIES = {
  textId: "--foreground",
  iconId: "--identity-icon",
  backgroundId: "--background",
  surfaceId: "--card",
  navigationId: "--nav-bg",
  accentId: "--primary",
} as const;

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
  "--identity-icon-foreground",
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
  const inkId = validBaseId === "family-ivory" ? DEFAULT_THEME_COLOR_ID : validBaseId;
  return {
    mode: "custom",
    baseId: validBaseId,
    textId: inkId,
    iconId: inkId,
    backgroundId: validBaseId,
    surfaceId: validBaseId,
    navigationId: inkId,
    accentId: inkId,
  };
}

export function getThemePreferenceBaseId(preference: ThemePreference): ThemeColorId {
  return preference.mode === "custom" ? preference.baseId : preference.presetId;
}

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  // Recover only the colors from the retired account preference format.
  if (value?.startsWith("appearance:")) {
    try {
      const stored = JSON.parse(value.slice("appearance:".length));
      value = stored?.v === 1 && typeof stored.color === "string" && !stored.color.startsWith("appearance:")
        ? stored.color
        : null;
    } catch {
      value = null;
    }
  }
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

/** Shared by advanced swatches, the preview and the applied account preference. */
export function getCustomThemeTokens(
  preference: CustomThemePreference,
  isDark: boolean,
): Record<string, string> {
  const text = getThemeColor(preference.textId);
  const icons = getThemeColor(preference.iconId);
  const background = getThemeColor(preference.backgroundId);
  const surfaces = getThemeColor(preference.surfaceId);
  const navigation = getThemeColor(preference.navigationId);
  const accent = getThemeColor(preference.accentId);
  const tokens: Record<string, string> = isDark
    ? balancedDarkTheme({ text, icons, background, surfaces, navigation, accent })
    : {
        "--foreground": text.navBg,
        "--card-foreground": text.navBg,
        "--popover-foreground": text.navBg,
        "--secondary-foreground": text.navBg,
        "--muted-foreground": text.primary,
        "--identity-text": text.navBg,
        "--identity-text-on-nav": text.tertiary,
        "--identity-icon": icons.primary,
        "--identity-icon-on-nav": icons.tertiary,
        "--background": background.space,
        "--identity-space": background.space,
        "--card": surfaces.soft,
        "--popover": surfaces.soft,
        "--secondary": surfaces.space,
        "--muted": surfaces.space,
        "--accent": surfaces.space,
        "--accent-foreground": text.navBg,
        "--identity-soft": surfaces.soft,
        "--identity-panel": surfaces.panel,
        "--nav-bg": navigation.navBg,
        "--identity-header": navigation.navBg,
        "--primary": accent.primary,
        "--primary-foreground": accent.foreground,
        "--gold-primary": accent.secondary,
        "--identity-accent": accent.secondary,
        "--identity-tertiary": accent.tertiary,
      };

  // In advanced customization this choice means the actual services ivory,
  // including text/icons/bars, rather than the ready-made identity's petrol ink.
  const ivoryRoles: Record<CustomThemeRole, string[]> = {
    textId: [
      "--foreground",
      "--card-foreground",
      "--popover-foreground",
      "--secondary-foreground",
      "--muted-foreground",
      "--accent-foreground",
      "--identity-text",
      "--identity-text-on-nav",
    ],
    iconId: ["--identity-icon", "--identity-icon-on-nav"],
    backgroundId: ["--background", "--identity-space", "--navy-base"],
    surfaceId: [
      "--card",
      "--popover",
      "--secondary",
      "--muted",
      "--accent",
      "--identity-soft",
      "--identity-panel",
      "--hero-card",
      "--hero-pill",
      "--navy-card",
    ],
    navigationId: ["--nav-bg", "--identity-header", "--hero-logo-badge"],
    accentId: [
      "--primary",
      "--gold-primary",
      "--gold-soft",
      "--identity-accent",
      "--identity-tertiary",
      "--ring",
    ],
  };
  for (const role of Object.keys(ivoryRoles) as CustomThemeRole[]) {
    if (preference[role] === "family-ivory") {
      for (const property of ivoryRoles[role]) tokens[property] = FAMILY_SERVICES_IVORY;
    }
  }
  const ivoryInk = getThemeColor(DEFAULT_THEME_COLOR_ID).navBg;
  if (preference.iconId === "family-ivory") tokens["--identity-icon-foreground"] = ivoryInk;
  if (preference.accentId === "family-ivory") tokens["--primary-foreground"] = ivoryInk;
  if (preference.navigationId === "family-ivory") {
    tokens["--identity-text-on-nav"] = text.navBg;
    tokens["--nav-fg"] = text.navBg;
    tokens["--identity-icon-on-nav"] = icons.primary;
  }
  return tokens;
}

export function getCustomRoleSwatch(themeId: ThemeColorId, role: CustomThemeRole, isDark: boolean) {
  const preference = { ...createCustomThemePreference(themeId), [role]: themeId };
  return getCustomThemeTokens(preference, isDark)[CUSTOM_ROLE_PROPERTIES[role]];
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const baseTheme = getThemeColor(getThemePreferenceBaseId(preference));
  clearCustomThemeProperties(root);
  applyThemeColors(baseTheme);
  root.dataset.themeColorBase = baseTheme.id;
  root.dataset.themeColorMode = preference.mode;
  if (preference.mode === "preset") return;

  const tokens = getCustomThemeTokens(preference, root.classList.contains("dark"));
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
  root.ownerDocument
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", tokens["--nav-bg"]);
}
