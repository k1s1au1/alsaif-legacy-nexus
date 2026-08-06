# إصلاح إشعارات الأندرويد وتفعيل نظام الـ Push الرسمي

بناءً على التحليل، يبدو أن هناك عدة أسباب تمنع وصول الإشعارات لتطبيق الأندرويد رغم عملها في المتصفح. الخطة تهدف لضمان ربط تطبيق الأندرويد بمشروع Firebase الصحيح وتفعيل الصلاحيات اللازمة.

## التغييرات المقترحة

### [أندرويد] إعدادات البيئة والبناء

#### [تعديل] [build.gradle](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/android/app/build.gradle)
* تبسيط وتصحيح طريقة تطبيق إضافة `google-services` لضمان قراءة ملف الإعدادات بشكل سليم في كافة ظروف البناء.
* التأكد من أن الـ `namespace` و الـ `applicationId` متطابقان تماماً مع ما هو موجود في Firebase Console.

#### [تعديل] [capacitor.config.ts](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/capacitor.config.ts)
* إضافة إعدادات الـ `PushNotifications` لتحديد كيفية ظهور الإشعارات (صوت، تنبيه، شارة) أثناء فتح التطبيق.

### [واجهة المستخدم] نظام الإشعارات (Native Push)

#### [تعديل] [pushNotifications.ts](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/lib/pushNotifications.ts)
* إضافة سجلات (Logs) مفصلة تظهر في الـ Console لمعرفة حالة التسجيل (Success/Error).
* تحسين معالجة إذن `POST_NOTIFICATIONS` الخاص بأندرويد 13 فما فوق.
* التأكد من حذف المستمعين (Listeners) القدامى قبل البدء لتجنب تكرار العمليات.

#### [تعديل] [use-fcm.ts](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/hooks/use-fcm.ts)
* تعزيز آلية التحقق من الصلاحيات قبل محاولة التسجيل.

## تنبيهات هامة للمستخدم
> [!IMPORTANT]
> بعد تطبيق هذه التغييرات، **يجب** عليك القيام بالخطوات التالية لتفعيلها:
> 1. تنفيذ أمر `npx cap copy` أو الضغط على "Sync Project with Gradle Files" في Android Studio.
> 2. **إعادة بناء التطبيق (Build & Run)** على جوالك.
> 3. الذهاب لصفحة الإعدادات والضغط على زر **"إعادة ربط الجوال"** لضمان تسجيل الـ Token الجديد للمشروع المحدث.

> [!WARNING]
> إذا كنت تستخدم مشروع Firebase قديم، تأكد من أن مفتاح `FCM_SERVICE_ACCOUNT` في لوحة تحكم Supabase يطابق المشروع الجديد المستخدم في ملف `google-services.json`.

## خطة التحقق

### الاختبارات اليدوية
* استخدام زر "إرسال تجربة" في صفحة الإعدادات للتأكد من وصول الإشعار.
* التأكد من ظهور إشعار نظام (System Notification) عند إرسال تنبيه والتطبيق في الخلفية.
