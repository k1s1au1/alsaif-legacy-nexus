# خطة إصلاح أخطاء الموقع وتحسين استقرار الأداء

تهدف هذه الخطة إلى حل المشاكل التقنية المكتشفة في الموقع، مع الالتزام التام بعدم المساس بنظام الإشعارات.

## المشاكل المكتشفة

1. **فشل بناء المشروع (Build Failure):** تعذر بناء الموقع بسبب استيراد مكتبة `@capacitor/app` في صفحة تحدي الخطوات، حيث أنها غير مثبتة أو يتم استدعاؤها بشكل غير آمن في بيئة الـ SSR (Server-Side Rendering).
2. **تذبذب اسم المستخدم (Name Flickering):** تكرار منطق جلب البيانات في عدة أماكن (AppShell وكل صفحة على حدة) يؤدي لظهور البريد الإلكتروني أو كلمة "تحميل" بدلاً من الاسم الحقيقي.
3. **تكرار منطق جلب الملف الشخصي:** يتم طلب بيانات الملف الشخصي مرتين (مرة في الصفحة ومرة في الـ AppShell) مما يستهلك موارد قاعدة البيانات ويبطئ الموقع.

## التغييرات المقترحة

### [Core / Build Fix]

#### [MODIFY] [steps-challenge.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/routes/_authenticated/steps-challenge.tsx)
- استخدام استيراد ديناميكي آمن (Safe Dynamic Import) لـ `@capacitor/app` للتأكد من عدم محاولة Vite تضمينها أثناء بناء نسخة الويب أو الـ SSR.

### [UI / UX Stabilization]

#### [MODIFY] [app-shell.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/components/app-shell.tsx)
- تحسين منطق عرض الاسم لمنع العودة للبريد الإلكتروني إذا كان الاسم العربي متاحاً بالفعل.
- تقليل الاعتماد على جلب البيانات المتكرر داخل المكون إذا كانت البيانات ممررة عبر الـ Props.

#### [MODIFY] [use-dashboard-data.ts](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/hooks/use-dashboard-data.ts)
- تحسين الـ Hook الخاص بالملف الشخصي لضمان توفير بيانات متسقة وسريعة.

## تنبيهات هامة
> [!CAUTION]
> لن يتم تعديل ملفات `pushNotifications.ts` أو `use-fcm.ts` أو أي منطق يتعلق بـ Firebase/Capacitor Push Notifications نهائياً بناءً على طلبك.

## خطة التحقق

### Automated Tests
- تشغيل عملية البناء (`npm run build`) للتأكد من حل مشكلة الاستيراد ونجاح البناء بالكامل.

### Manual Verification
- التحقق من ثبات اسم "أبو الوليد" في الأعلى عند التنقل بين الصفحات.
- التأكد من عمل صفحة "تحدي الخطوات" بشكل طبيعي.
