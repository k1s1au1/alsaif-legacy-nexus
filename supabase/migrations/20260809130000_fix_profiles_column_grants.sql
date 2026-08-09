-- فك حظر الصلاحيات عن الأعمدة الجديدة لضمان عمل البار السفلي والصلاحيات للجميع
GRANT SELECT (bottom_nav_prefs, allowed_sections) ON public.profiles TO authenticated;
GRANT UPDATE (bottom_nav_prefs, allowed_sections) ON public.profiles TO authenticated;

-- التأكد من أن جميع الأعضاء يمكنهم رؤية هذه الأعمدة في ملفاتهم الشخصية
COMMENT ON COLUMN public.profiles.bottom_nav_prefs IS 'تفضيلات البار السفلي للمستخدم';
COMMENT ON COLUMN public.profiles.allowed_sections IS 'الأقسام المسموح للضيف بدخولها';
