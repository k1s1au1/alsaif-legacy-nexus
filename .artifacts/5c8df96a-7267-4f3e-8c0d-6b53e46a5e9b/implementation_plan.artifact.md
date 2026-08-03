# تفعيل Health Connect واختصارات التطبيق (App Shortcuts)

سأقوم بتنفيذ مقترحين لتعزيز الجانب التقني والواقعي للتطبيق: ربط تحدي الخطوات بـ Health Connect وتوفير اختصارات سريعة للوصول إلى أقسام التطبيق الهامة.

## التغييرات المقترحة

### [أندرويد] دمج Health Connect

#### [تعديل] [build.gradle](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/build.gradle)
* إضافة مكتبة `androidx.health.connect:connect-client` لتمكين التواصل مع تطبيق Health Connect.

#### [تعديل] [StepsPlugin.java](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/java/com/alsaif/familyhub/StepsPlugin.java)
* إضافة دوال للتحقق من وجود Health Connect.
* إضافة دوال لطلب صلاحيات القراءة والكتابة للخطوات.
* تعديل دالة `getTodaySteps` لجلب البيانات من Health Connect كأولوية، والرجوع للحساس (Step Counter) في حال عدم توفره.

### [أندرويد] اختصارات التطبيق (App Shortcuts)

#### [تعديل] [strings.xml](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/res/values/strings.xml)
* إضافة نصوص عربية للاختصارات الجديدة (المجلس، الخزنة، شجرة العائلة).

#### [تعديل] [shortcuts.xml](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/res/xml/shortcuts.xml)
* إضافة اختصارات ثابتة (Static Shortcuts) تظهر عند الضغط المطول على أيقونة التطبيق.
* ربط هذه الاختصارات بالـ Deep Links الحالية (`alsaif://...`).

### [تطوير الويب] تحدي الخطوات

#### [تعديل] [steps-challenge.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/routes/_authenticated/steps-challenge.tsx)
* تحديث واجهة طلب الأذونات لتشمل طلب إذن Health Connect الحقيقي عبر الـ Plugin المحدث.
* التعامل مع الاستجابات الجديدة من `StepsPlugin`.

#### [تعديل] [capacitor-client.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/capacitor-client.tsx)
* التأكد من معالجة كافة الروابط العميقة (Deep Links) الجديدة للاختصارات.

## خطة التحقق

### الاختبارات الآلية
* التأكد من بناء المشروع (Build) بدون أخطاء بعد إضافة المكتبات الجديدة.

### التحقق اليدوي
* اختبار ظهور الاختصارات عند الضغط المطول على أيقونة التطبيق.
* محاولة ربط الخطوات في صفحة التحدي والتأكد من استلام طلب الإذن (على محاكي أو جهاز يدعم Health Connect).
