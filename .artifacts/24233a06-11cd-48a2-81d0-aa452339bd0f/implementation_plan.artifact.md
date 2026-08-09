# خطة تسجيل تطبيق "المجلس" في نظام Health Connect 🛡️🔋

لكي يظهر التطبيق في إعدادات Health Connect ويسمح لك بمنح الصلاحيات، يحتاج نظام أندرويد لتعريفات محددة في ملفات النظام (Manifest) تخبره بأن هذا التطبيق شريك رسمي للنظام الصحي.

## التغييرات المقترحة

### [Android / Manifest]

#### [تعديل] [AndroidManifest.xml](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/AndroidManifest.xml)
*   **إضافة رابط سياسة الخصوصية:** يتطلب Health Connect وجود رابط صريح لسياسة الخصوصية داخل الـ Manifest لكي يظهر التطبيق في القائمة.
*   **تحديث الـ Intent Filter:** إضافة تصنيف `android.intent.category.DEFAULT` لنشاط الصحة لضمان استجابة النظام له عند الطلب.
*   **إضافة Meta-data:** تعريف وسم `health_permissions_rationale` الذي يربط التطبيق بنظام أذونات الصحة الرسمي.

### [Android / Resources]

#### [تعديل] [strings.xml](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/res/values/strings.xml)
*   إضافة نصوص توضيحية لسبب طلب صلاحيات الصحة (Rationale) لكي تظهر للمستخدم عند فتح إعدادات Health Connect.

### [Web / Logic]

#### [تعديل] [StepsPlugin.java](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/src/main/java/com/alsaif/familyhub/StepsPlugin.java)
*   تحسين دالة `getHealthConnectSteps` لتقوم بفتح صفحة "طلب الأذونات" الرسمية مباشرة إذا لم تكن ممنوحة، بدلاً من مجرد إرجاع حالة الخطأ.

## خطة التحقق

### التحقق اليدوي (أندرويد)
1. تشغيل التطبيق والذهاب لصفحة تحدي الخطوات.
2. الضغط على "ربط مع Health Connect".
3. الانتقال لإعدادات الجوال -> الصحة -> Health Connect -> تطبيقات -> والتأكد من ظهور "المجلس" في القائمة.
4. التأكد من القدرة على تفعيل مفتاح "الخطوات" (Steps) يدوياً من هناك.

> [!IMPORTANT]
> بعد هذه التعديلات، سيعتبر أندرويد تطبيق "المجلس" تطبيقاً صحياً معتمداً وسيعرضه في قائمة التطبيقات المرتبطة بالصحة.

**هل أبدأ في تحديث ملفات النظام لظهور التطبيق في Health Connect؟**
