export const APP_FONTS = [
  { id: "Tajawal", name: "تجوال (عصري)", family: "'Tajawal', sans-serif", desc: "خط ناعم وأنيق" },
  { id: "Cairo", name: "كايـرو (عريض)", family: "'Cairo', sans-serif", desc: "وضوح عالي جداً" },
  { id: "Lalezar", name: "لاليزار (فني)", family: "'Lalezar', cursive", desc: "خط عريض ومميز" },
  { id: "Amiri", name: "الأميري (تراثي)", family: "'Amiri', serif", desc: "طابع كلاسيكي فاخر" },
  { id: "Changa", name: "شانغا (هندسي)", family: "'Changa', sans-serif", desc: "زوايا حادة وقوية" },
  {
    id: "ReemKufi",
    name: "ريم كوفي (كوفي)",
    family: "'Reem Kufi', sans-serif",
    desc: "أصالة الخط الكوفي",
  },
  {
    id: "Markazi",
    name: "مركزي (أدبي)",
    family: "'Markazi Text', serif",
    desc: "خط الكتب والروايات",
  },
  {
    id: "Vazirmatn",
    name: "وزير (بسيط)",
    family: "'Vazirmatn', sans-serif",
    desc: "بساطة تقنية حديثة",
  },
];

// Every selectable family is loaded by the app shell, including Safari/PWA entry.
export const APP_FONT_STYLESHEET_URL = "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;500;600;700;800&family=Changa:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Lalezar&family=Markazi+Text:wght@400;500;600;700&family=Reem+Kufi:wght@400;500;600;700&family=Tajawal:wght@400;500;700;800&family=Vazirmatn:wght@400;500;600;700;800&display=swap";

export function applyAppFont(fontFamily: string) {
  document.documentElement.style.setProperty("--app-font", fontFamily);
}

export function restoreAppTypography() {
  try {
    const selected = APP_FONTS.find((font) => font.id === localStorage.getItem("app-font-id"));
    if (selected) applyAppFont(selected.family);

    const savedScale = localStorage.getItem("app-font-scale");
    const scale = Number(savedScale);
    if (savedScale !== null && Number.isFinite(scale) && scale >= 0.8 && scale <= 1.5) {
      document.documentElement.style.setProperty("--app-font-scale", String(scale));
      document.documentElement.style.fontSize = `calc(16px * ${scale})`;
    }

    const savedStyle = localStorage.getItem("font-style");
    if (savedStyle === "royal" || savedStyle === "modern") {
      document.documentElement.classList.toggle("font-royal-mode", savedStyle === "royal");
    }
  } catch {
    // Storage can be unavailable in private Safari; retain the normal inherited font.
  }
}

