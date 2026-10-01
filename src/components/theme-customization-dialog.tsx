import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CreditCard,
  LayoutGrid,
  MousePointerClick,
  Navigation,
  Palette,
  Shapes,
  Star,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import { THEME_COLORS } from "@/lib/themes";
import {
  applyThemePreference,
  createCustomThemePreference,
  createPresetThemePreference,
  getThemeColor,
  getThemePreferenceBaseId,
  type CustomThemePreference,
  type ThemeColorId,
  type ThemePreference,
} from "@/lib/theme-preferences";
import "@/theme-customization-dialog.css";

type CustomRoleKey = Exclude<keyof CustomThemePreference, "mode" | "baseId">;

type RoleDefinition = {
  key: CustomRoleKey;
  label: string;
  description: string;
  icon: LucideIcon;
};

const CUSTOM_ROLES: RoleDefinition[] = [
  {
    key: "textId",
    label: "النصوص",
    description: "العناوين والكتابة العامة",
    icon: Type,
  },
  {
    key: "iconId",
    label: "الأيقونات",
    description: "رموز التنقل والخدمات",
    icon: Shapes,
  },
  {
    key: "backgroundId",
    label: "خلفية الموقع",
    description: "المساحة الأساسية للصفحات",
    icon: LayoutGrid,
  },
  {
    key: "surfaceId",
    label: "البطاقات والأسطح",
    description: "البطاقات والنوافذ والقوائم",
    icon: CreditCard,
  },
  {
    key: "navigationId",
    label: "البار العلوي والسفلي",
    description: "خلفية أشرطة التنقل",
    icon: Navigation,
  },
  {
    key: "accentId",
    label: "الأزرار والعناصر البارزة",
    description: "الأزرار والتحديد واللمسات المهمة",
    icon: MousePointerClick,
  },
];

function getRoleSwatch(themeId: ThemeColorId, role: CustomRoleKey, isDark: boolean) {
  const theme = getThemeColor(themeId);
  switch (role) {
    case "textId":
      return isDark ? theme.darkSecondary : theme.navBg;
    case "iconId":
      return isDark ? theme.darkSecondary : theme.primary;
    case "backgroundId":
      return isDark ? theme.darkSpace : theme.space;
    case "surfaceId":
      return isDark ? theme.darkSoft : theme.soft;
    case "navigationId":
      return isDark ? theme.darkNavBg : theme.navBg;
    case "accentId":
      return isDark ? theme.darkPrimary : theme.primary;
  }
}

function PreferencePreview({ preference }: { preference: CustomThemePreference }) {
  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const textTheme = getThemeColor(preference.textId);
  const iconTheme = getThemeColor(preference.iconId);
  const backgroundTheme = getThemeColor(preference.backgroundId);
  const surfaceTheme = getThemeColor(preference.surfaceId);
  const navigationTheme = getThemeColor(preference.navigationId);
  const accentTheme = getThemeColor(preference.accentId);

  const colors = {
    text: isDark ? textTheme.darkSecondary : textTheme.navBg,
    mutedText: isDark ? textTheme.darkSecondary : textTheme.primary,
    icon: isDark ? iconTheme.darkSecondary : iconTheme.primary,
    iconOnNavigation: isDark ? iconTheme.darkSecondary : iconTheme.tertiary,
    background: isDark ? backgroundTheme.darkSpace : backgroundTheme.space,
    surface: isDark ? surfaceTheme.darkSoft : surfaceTheme.soft,
    navigation: isDark ? navigationTheme.darkNavBg : navigationTheme.navBg,
    accent: isDark ? accentTheme.darkPrimary : accentTheme.primary,
    buttonText: accentTheme.foreground,
  };

  return (
    <div
      className="theme-customizer-preview"
      style={{ backgroundColor: colors.background, color: colors.text }}
      aria-label="معاينة مباشرة للألوان"
    >
      <div
        className="theme-customizer-preview-nav"
        style={{ backgroundColor: colors.navigation, color: colors.iconOnNavigation }}
      >
        <Palette aria-hidden="true" />
        <span>معاينة لوحة العائلة</span>
        <Navigation aria-hidden="true" />
      </div>
      <div className="theme-customizer-preview-body">
        <div className="theme-customizer-preview-card" style={{ backgroundColor: colors.surface }}>
          <span
            className="theme-customizer-preview-icon"
            style={{ backgroundColor: colors.icon, color: iconTheme.foreground }}
          >
            <Shapes aria-hidden="true" />
          </span>
          <span>
            <b style={{ color: colors.text }}>خدمات العائلة</b>
            <small style={{ color: colors.mutedText }}>هكذا تظهر النصوص والبطاقات بعد الحفظ</small>
          </span>
        </div>
        <button
          type="button"
          tabIndex={-1}
          style={{ backgroundColor: colors.accent, color: colors.buttonText }}
        >
          زر تجريبي
        </button>
      </div>
    </div>
  );
}

export function ThemeCustomizationDialog({
  preference,
  onClose,
  onSave,
}: {
  preference: ThemePreference;
  onClose: () => void;
  onSave: (preference: ThemePreference) => void;
}) {
  const initialBaseId = getThemePreferenceBaseId(preference);
  const [mode, setMode] = useState<ThemePreference["mode"]>(preference.mode);
  const [presetId, setPresetId] = useState<ThemeColorId>(initialBaseId);
  const [customDraft, setCustomDraft] = useState<CustomThemePreference>(() =>
    preference.mode === "custom" ? preference : createCustomThemePreference(initialBaseId),
  );

  const closeWithoutSaving = () => {
    applyThemePreference(preference);
    onClose();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeWithoutSaving();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const chooseMode = (nextMode: ThemePreference["mode"]) => {
    setMode(nextMode);
    applyThemePreference(
      nextMode === "preset" ? createPresetThemePreference(presetId) : customDraft,
    );
  };

  const choosePreset = (nextPresetId: ThemeColorId) => {
    setPresetId(nextPresetId);
    setCustomDraft(createCustomThemePreference(nextPresetId));
    applyThemePreference(createPresetThemePreference(nextPresetId));
  };

  const chooseCustomRole = (role: CustomRoleKey, themeId: ThemeColorId) => {
    const nextPreference = { ...customDraft, [role]: themeId };
    setCustomDraft(nextPreference);
    applyThemePreference(nextPreference);
  };

  const save = () => {
    const nextPreference = mode === "preset" ? createPresetThemePreference(presetId) : customDraft;
    applyThemePreference(nextPreference);
    onSave(nextPreference);
  };

  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  return (
    <motion.div
      className="theme-customizer-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeWithoutSaving();
      }}
      dir="rtl"
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-customizer-title"
        className="theme-customizer-dialog"
        initial={{ y: 24, scale: 0.97, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 16, scale: 0.98, opacity: 0 }}
      >
        <header className="theme-customizer-header">
          <div className="theme-customizer-title-mark" aria-hidden="true">
            <Palette />
          </div>
          <div>
            <span>تخصيص شخصي لكل حساب</span>
            <h2 id="theme-customizer-title">ألوان الموقع</h2>
            <p>اختر هوية جاهزة أو وزّع ألوان الهويات الحالية بنفسك.</p>
          </div>
          <button
            type="button"
            className="theme-customizer-close"
            onClick={closeWithoutSaving}
            aria-label="إغلاق من دون حفظ"
          >
            <X />
          </button>
        </header>

        <div
          className="theme-customizer-mode-tabs"
          role="tablist"
          aria-label="طريقة اختيار الألوان"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preset"}
            className={mode === "preset" ? "is-active" : undefined}
            onClick={() => chooseMode("preset")}
          >
            <Star />
            <span>
              <b>اختيار جاهز</b>
              <small>الأسرع والأسهل</small>
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "custom"}
            className={mode === "custom" ? "is-active" : undefined}
            onClick={() => chooseMode("custom")}
          >
            <Palette />
            <span>
              <b>تخصيص متقدم</b>
              <small>كل جزء بلون مستقل</small>
            </span>
          </button>
        </div>

        <div className="theme-customizer-content">
          {mode === "preset" ? (
            <div className="theme-customizer-presets" role="tabpanel">
              <div className="theme-customizer-section-copy">
                <h3>هويات جاهزة بضغطة واحدة</h3>
                <p>يتم توزيع ألوان الهوية تلقائيًا على كامل الموقع.</p>
              </div>
              <div className="theme-customizer-preset-grid">
                {THEME_COLORS.map((theme) => {
                  const selected = presetId === theme.id;
                  return (
                    <button
                      type="button"
                      key={theme.id}
                      aria-pressed={selected}
                      className={selected ? "is-selected" : undefined}
                      onClick={() => choosePreset(theme.id)}
                    >
                      <span className="theme-customizer-palette" aria-hidden="true">
                        {theme.palette.map((color) => (
                          <i key={color} style={{ backgroundColor: color }} />
                        ))}
                      </span>
                      <span className="theme-customizer-preset-name">
                        <b>{theme.name}</b>
                        <small>{theme.isPrimary ? "الهوية الأساسية" : "هوية جاهزة"}</small>
                      </span>
                      {selected && (
                        <span className="theme-customizer-selected" aria-hidden="true">
                          <Check />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="theme-customizer-advanced" role="tabpanel">
              <div className="theme-customizer-section-copy">
                <h3>خصص كل جزء لحاله</h3>
                <p>اختر من نفس الهويات الموجودة؛ درجة الوضوح المناسبة تُستخدم تلقائيًا.</p>
              </div>

              <PreferencePreview preference={customDraft} />

              <div className="theme-customizer-role-list">
                {CUSTOM_ROLES.map((role) => {
                  const RoleIcon = role.icon;
                  return (
                    <fieldset key={role.key} className="theme-customizer-role">
                      <legend>
                        <span aria-hidden="true">
                          <RoleIcon />
                        </span>
                        <span>
                          <b>{role.label}</b>
                          <small>{role.description}</small>
                        </span>
                      </legend>
                      <div className="theme-customizer-role-options">
                        {THEME_COLORS.map((theme) => {
                          const selected = customDraft[role.key] === theme.id;
                          return (
                            <button
                              type="button"
                              key={theme.id}
                              aria-label={`${role.label}: ${theme.name}`}
                              aria-pressed={selected}
                              className={selected ? "is-selected" : undefined}
                              onClick={() => chooseCustomRole(role.key, theme.id)}
                              title={theme.name}
                            >
                              <i
                                aria-hidden="true"
                                style={{
                                  backgroundColor: getRoleSwatch(theme.id, role.key, isDark),
                                }}
                              />
                              {selected && <Check aria-hidden="true" />}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <footer className="theme-customizer-footer">
          <span>
            <Check aria-hidden="true" />
            يحفظ الاختيار لهذا الحساب على جميع أجهزته
          </span>
          <div>
            {mode === "custom" && (
              <button
                type="button"
                className="theme-customizer-reset"
                onClick={() => {
                  const baseId = customDraft.baseId;
                  setPresetId(baseId);
                  chooseMode("preset");
                }}
              >
                العودة للوضع الجاهز
              </button>
            )}
            <button type="button" className="theme-customizer-save" onClick={save}>
              تطبيق وحفظ
            </button>
          </div>
        </footer>
      </motion.section>
    </motion.div>
  );
}
