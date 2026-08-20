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
    space: "#E7EEE9",
    darkSpace: "#102D27",
    panel: "#155A4C",
    darkPanel: "#0B3A31",
    soft: "#F4F1E9",
    darkSoft: "#172C27",
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
    space: "#E8EEEA",
    darkSpace: "#142B27",
    panel: "#285F55",
    darkPanel: "#123D35",
    soft: "#F4F0E6",
    darkSoft: "#1A2B27",
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
    space: "#F0E7D5",
    darkSpace: "#342916",
    panel: "#84652F",
    darkPanel: "#4A371A",
    soft: "#F7F0E4",
    darkSoft: "#30281C",
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
    space: "#E9E9DD",
    darkSpace: "#282B1B",
    panel: "#747B52",
    darkPanel: "#43482C",
    soft: "#F4F0E4",
    darkSoft: "#2A2A20",
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
    space: "#E4EAEB",
    darkSpace: "#172629",
    panel: "#36575C",
    darkPanel: "#203A3E",
    soft: "#F2EFE7",
    darkSoft: "#202B2C",
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
    space: "#F4EFE6",
    darkSpace: "#2D2922",
    panel: "#D9CDB9",
    darkPanel: "#3D352A",
    soft: "#FBF8F1",
    darkSoft: "#312C24",
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
    space: "#EFE6D7",
    darkSpace: "#342B1D",
    panel: "#B39A73",
    darkPanel: "#5C4930",
    soft: "#F7F1E8",
    darkSoft: "#332D24",
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
    space: "#ECE4DC",
    darkSpace: "#2B211C",
    panel: "#5A4031",
    darkPanel: "#35251D",
    soft: "#F5EFE8",
    darkSoft: "#302620",
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
  const space = isDark ? colors.darkSpace : colors.space;
  const panel = isDark ? colors.darkPanel : colors.panel;
  const soft = isDark ? colors.darkSoft : colors.soft;

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--gold-primary", accent);
  root.style.setProperty("--primary-foreground", colors.foreground);
  root.style.setProperty("--nav-bg", header);

  root.style.setProperty("--identity-header", header);
  root.style.setProperty("--identity-space", space);
  root.style.setProperty("--identity-panel", panel);
  root.style.setProperty("--identity-soft", soft);
  root.style.setProperty("--identity-accent", accent);
  root.style.setProperty("--identity-text", accent);

  if (colors.mesh) {
    root.style.setProperty("--mesh-color-1", colors.mesh[0]);
    root.style.setProperty("--mesh-color-2", colors.mesh[1]);
  }
}
