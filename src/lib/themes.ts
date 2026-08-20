export const THEME_COLORS = [
  {
    id: "emerald",
    name: "أخضر السيف (الأصلي)",
    primary: "#0B5D4B",
    secondary: "#C6A45F",
    darkPrimary: "#2F8B70",
    darkSecondary: "#E0C47F",
    foreground: "#FFFFFF",
    navBg: "#063D31",
    darkNavBg: "#031F19",
    isPrimary: true,
    mesh: ["rgba(198, 164, 95, 0.14)", "rgba(11, 93, 75, 0.10)"],
  },
  {
    id: "royal-gold",
    name: "أخضر المجلس",
    primary: "#174F46",
    secondary: "#BFA064",
    darkPrimary: "#4C927D",
    darkSecondary: "#D8BE82",
    foreground: "#FFFFFF",
    navBg: "#0D352F",
    darkNavBg: "#061C18",
    mesh: ["rgba(191, 160, 100, 0.14)", "rgba(23, 79, 70, 0.10)"],
  },
  {
    id: "vibrant-emerald",
    name: "ذهب السيف",
    primary: "#A37D3E",
    secondary: "#1F6253",
    darkPrimary: "#C7A45E",
    darkSecondary: "#63A38C",
    foreground: "#1D342E",
    navBg: "#60471F",
    darkNavBg: "#2B1F0D",
    mesh: ["rgba(163, 125, 62, 0.15)", "rgba(31, 98, 83, 0.10)"],
  },
  {
    id: "midnight",
    name: "زيتوني هادئ",
    primary: "#626B43",
    secondary: "#BFA261",
    darkPrimary: "#98A36D",
    darkSecondary: "#D9C17F",
    foreground: "#FFFFFF",
    navBg: "#3B4127",
    darkNavBg: "#1B1E10",
    mesh: ["rgba(191, 162, 97, 0.14)", "rgba(98, 107, 67, 0.10)"],
  },
  {
    id: "burgundy",
    name: "كحلي السمر",
    primary: "#253F43",
    secondary: "#B8995D",
    darkPrimary: "#64858A",
    darkSecondary: "#D5BD82",
    foreground: "#FFFFFF",
    navBg: "#172A2D",
    darkNavBg: "#091416",
    mesh: ["rgba(184, 153, 93, 0.14)", "rgba(37, 63, 67, 0.10)"],
  },
  {
    id: "pure-white",
    name: "العاجي الدافئ",
    primary: "#EEE5D3",
    secondary: "#8A6B3F",
    darkPrimary: "#D8CBB4",
    darkSecondary: "#C7A96B",
    foreground: "#173E35",
    navBg: "#D8CDBA",
    darkNavBg: "#28231C",
    mesh: ["rgba(138, 107, 63, 0.13)", "rgba(238, 229, 211, 0.18)"],
  },
  {
    id: "sand",
    name: "رمل الديوان",
    primary: "#B39464",
    secondary: "#31594F",
    darkPrimary: "#CFB484",
    darkSecondary: "#6F9E8C",
    foreground: "#203A33",
    navBg: "#6A5534",
    darkNavBg: "#2A2113",
    mesh: ["rgba(179, 148, 100, 0.15)", "rgba(49, 89, 79, 0.10)"],
  },
  {
    id: "royal-oud",
    name: "العود الملكي",
    primary: "#443024",
    secondary: "#BFA274",
    darkPrimary: "#745849",
    darkSecondary: "#D8BB8A",
    foreground: "#FFFFFF",
    navBg: "#2D1F18",
    darkNavBg: "#160D09",
    mesh: ["rgba(191, 162, 116, 0.15)", "rgba(68, 48, 36, 0.11)"],
  },
];

export function applyThemeColors(colors: (typeof THEME_COLORS)[0]) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");

  const primary = isDark ? colors.darkPrimary : colors.primary;
  const accent = isDark ? (colors.darkSecondary || colors.secondary) : colors.secondary;
  const header = isDark ? colors.darkNavBg : colors.navBg;

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--gold-primary", accent);
  root.style.setProperty("--primary-foreground", colors.foreground);
  root.style.setProperty("--nav-bg", header);

  // Layered identity tones: every selected identity now provides distinct tones
  // for header, page gaps/surfaces, panels and accent text instead of painting
  // the whole interface with one flat color.
  root.style.setProperty("--identity-header", header);
  root.style.setProperty("--identity-space", `color-mix(in srgb, ${primary} 72%, ${accent} 28%)`);
  root.style.setProperty("--identity-panel", `color-mix(in srgb, ${header} 78%, ${primary} 22%)`);
  root.style.setProperty("--identity-soft", `color-mix(in srgb, ${primary} 18%, var(--background) 82%)`);
  root.style.setProperty("--identity-accent", accent);
  root.style.setProperty("--identity-text", `color-mix(in srgb, ${accent} 78%, white 22%)`);

  if (colors.mesh) {
    root.style.setProperty("--mesh-color-1", colors.mesh[0]);
    root.style.setProperty("--mesh-color-2", colors.mesh[1]);
  }
}
