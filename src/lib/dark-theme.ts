/** Balanced dark surfaces are derived from the selected identity, including custom roles. */
type DarkIdentity = {
  darkPrimary: string;
  darkSecondary: string;
  darkNavBg: string;
  darkSpace: string;
  darkPanel: string;
  darkSoft: string;
};

export type DarkThemeRoles = Record<
  "text" | "icons" | "background" | "surfaces" | "navigation" | "accent",
  DarkIdentity
>;

function mix(first: string, second: string, firstWeight: number) {
  const channels = (value: string) =>
    [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  const a = channels(first);
  const b = channels(second);
  return `#${a
    .map((channel, index) =>
      Math.round(channel * firstWeight + b[index] * (1 - firstWeight))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function luminance(color: string) {
  return [1, 3, 5]
    .map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function readableOn(color: string, surfaces: string[], target: number) {
  let result = color;
  for (let step = 0; step < 20; step++) {
    if (
      surfaces.every(
        (surface) => (luminance(result) + 0.05) / (luminance(surface) + 0.05) >= target,
      )
    )
      break;
    result = mix(result, "#f4f3e9", 0.94);
  }
  return result;
}

export function balancedDarkTheme(roles: DarkThemeRoles) {
  const background = mix(roles.background.darkSpace, "#000000", 0.62);
  const card = mix(roles.surfaces.darkSoft, "#000000", 0.88);
  const raised = mix(roles.surfaces.darkSoft, roles.surfaces.darkPanel, 0.62);
  const navigation = mix(roles.navigation.darkNavBg, roles.navigation.darkSoft, 0.68);
  const text = mix("#f4f3e9", roles.text.darkSecondary, 0.9);
  const mutedText = mix(roles.text.darkSecondary, "#d8ded8", 0.54);
  const primary = readableOn(
    mix(roles.accent.darkPrimary, roles.accent.darkSecondary, 0.68),
    [card, raised, navigation, background],
    4.5,
  );
  const onPrimary = mix(roles.accent.darkNavBg, "#000000", 0.45);
  const icon = readableOn(
    mix(roles.icons.darkPrimary, roles.icons.darkSecondary, 0.68),
    [card, raised, navigation],
    3,
  );

  return {
    "--background": background,
    "--foreground": text,
    "--card": card,
    "--card-foreground": text,
    "--popover": raised,
    "--popover-foreground": text,
    "--primary": primary,
    "--primary-foreground": onPrimary,
    "--secondary": raised,
    "--secondary-foreground": text,
    "--muted": mix(card, raised, 0.65),
    "--muted-foreground": mutedText,
    "--accent": raised,
    "--accent-foreground": text,
    "--border": mix(text, card, 0.2),
    "--input": readableOn(mix(text, card, 0.42), [card, raised, background], 3),
    "--ring": primary,
    "--nav-bg": navigation,
    "--nav-fg": text,
    "--gold-primary": primary,
    "--gold-soft": roles.accent.darkSecondary,
    "--hero-card": card,
    "--hero-pill": raised,
    "--hero-pill-border": mix(text, raised, 0.2),
    "--hero-divider": mix(text, raised, 0.24),
    "--hero-logo-badge": navigation,
    "--navy-base": background,
    "--navy-card": card,
    "--ivory": text,
    "--identity-space": background,
    "--identity-soft": card,
    "--identity-panel": raised,
    "--identity-header": navigation,
    "--identity-text": text,
    "--identity-text-on-nav": text,
    "--identity-icon": icon,
    "--identity-icon-on-nav": icon,
    "--identity-accent": primary,
    "--identity-tertiary": roles.accent.darkSecondary,
  };
}

export function applyBalancedDarkTheme(root: HTMLElement, roles: DarkThemeRoles) {
  const properties = balancedDarkTheme(roles);
  for (const [name, value] of Object.entries(properties)) root.style.setProperty(name, value);
  root.ownerDocument
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", properties["--nav-bg"]);
}
