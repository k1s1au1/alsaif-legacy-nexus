export const THEME_COLORS = [
  {
    id: "emerald",
    name: "بترولي السيف",
    primary: "#114E4D",
    secondary: "#2A7F7B",
    tertiary: "#A7D1CC",
    palette: ["#114E4D", "#2A7F7B", "#A7D1CC"],
    darkPrimary: "#5FA9A5",
    darkSecondary: "#A7D1CC",
    foreground: "#FFFFFF",
    navBg: "#0D3F3E",
    darkNavBg: "#082928",
    space: "#E7F1F0",
    darkSpace: "#102E2D",
    panel: "#2A7F7B",
    darkPanel: "#174C4A",
    soft: "#F2F8F7",
    darkSoft: "#173534",
    isPrimary: true,
    mesh: ["rgba(42, 127, 123, 0.15)", "rgba(167, 209, 204, 0.16)"],
  },
  {
    id: "royal-gold",
    name: "ذهبي الشعار",
    primary: "#A68E63",
    secondary: "#D4B06A",
    tertiary: "#F3E6C7",
    palette: ["#A68E63", "#D4B06A", "#F3E6C7"],
    darkPrimary: "#D4B06A",
    darkSecondary: "#F3E6C7",
    foreground: "#20211E",
    navBg: "#75613F",
    darkNavBg: "#3A3021",
    space: "#F3E6C7",
    darkSpace: "#30291F",
    panel: "#C3A169",
    darkPanel: "#5C4B34",
    soft: "#FBF6EA",
    darkSoft: "#393126",
    mesh: ["rgba(212, 176, 106, 0.17)", "rgba(243, 230, 199, 0.22)"],
  },
  {
    id: "midnight",
    name: "الزيتوني الحجري",
    primary: "#60635B",
    secondary: "#8A9480",
    tertiary: "#D7D9CD",
    palette: ["#60635B", "#8A9480", "#D7D9CD"],
    darkPrimary: "#AEB6A7",
    darkSecondary: "#D7D9CD",
    foreground: "#FFFFFF",
    navBg: "#484C44",
    darkNavBg: "#272A25",
    space: "#ECEDE7",
    darkSpace: "#2D302B",
    panel: "#7A8372",
    darkPanel: "#4A5046",
    soft: "#F5F5F0",
    darkSoft: "#353832",
    mesh: ["rgba(138, 148, 128, 0.15)", "rgba(215, 217, 205, 0.18)"],
  },
  {
    id: "royal-copper",
    name: "نحاسي ملكي",
    primary: "#7A4E2D",
    secondary: "#B97A4A",
    tertiary: "#E6C7A8",
    palette: ["#7A4E2D", "#B97A4A", "#E6C7A8"],
    darkPrimary: "#C38A59",
    darkSecondary: "#E6C7A8",
    foreground: "#FFFFFF",
    navBg: "#5B391F",
    darkNavBg: "#2E1C10",
    space: "#F3E5D8",
    darkSpace: "#2F241D",
    panel: "#9A6840",
    darkPanel: "#4A2E1B",
    soft: "#FBF5EE",
    darkSoft: "#382A22",
    mesh: ["rgba(185, 122, 74, 0.16)", "rgba(230, 199, 168, 0.18)"],
  },
  {
    id: "muted-palm",
    name: "أخضر نخلي مطفي",
    primary: "#405743",
    secondary: "#73806B",
    tertiary: "#D2D7C8",
    palette: ["#405743", "#73806B", "#D2D7C8"],
    darkPrimary: "#8E9B86",
    darkSecondary: "#D2D7C8",
    foreground: "#FFFFFF",
    navBg: "#314235",
    darkNavBg: "#1D2720",
    space: "#EDF0E8",
    darkSpace: "#293029",
    panel: "#65725E",
    darkPanel: "#414A3D",
    soft: "#F7F8F3",
    darkSoft: "#343A33",
    mesh: ["rgba(115, 128, 107, 0.15)", "rgba(210, 215, 200, 0.18)"],
  },
  {
    id: "heritage-maroon",
    name: "عنابي تراثي",
    primary: "#5E2F34",
    secondary: "#8E5158",
    tertiary: "#D8B7BA",
    palette: ["#5E2F34", "#8E5158", "#D8B7BA"],
    darkPrimary: "#A56A71",
    darkSecondary: "#D8B7BA",
    foreground: "#FFFFFF",
    navBg: "#472328",
    darkNavBg: "#241215",
    space: "#F1E4E5",
    darkSpace: "#2E2224",
    panel: "#7A444B",
    darkPanel: "#562E33",
    soft: "#FAF2F3",
    darkSoft: "#39282B",
    mesh: ["rgba(142, 81, 88, 0.16)", "rgba(216, 183, 186, 0.18)"],
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
  root.style.setProperty("--identity-tertiary", colors.tertiary);
  root.style.setProperty("--identity-text", accent);

  if (colors.mesh) {
    root.style.setProperty("--mesh-color-1", colors.mesh[0]);
    root.style.setProperty("--mesh-color-2", colors.mesh[1]);
  }
}
