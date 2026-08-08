# خطة تحديث أيقونة الشاشة الرئيسية (iPhone و Android)

تهدف هذه الخطة إلى ربط شعار المجلس بشكل صحيح عند إضافة التطبيق للشاشة الرئيسية في أجهزة الآيفون والأندرويد، مع ضمان ظهور الشعار بالشكل المطلوب (Alsaif Logo).

## User Review Required

> [!IMPORTANT]
> تم اكتشاف أن روابط أيقونة "Apple Touch Icon" وملف "Manifest" مفقودة من الكود الأساسي الذي يتم رندرة الصفحات من خلاله (`__root.tsx`)، مما يجعل المتصفح يستخدم أيقونة افتراضية بدلاً من شعار المجلس.

> [!TIP]
> للحصول على أفضل نتيجة في أجهزة الأندرويد الحديثة (Maskable Icons)، يفضل أن تكون صورة الشعار `logo-home.png` محاطة بهامش كافٍ (Padding) لكي لا يتم قص أطراف الشعار عند تحويله إلى شكل دائري.

## Proposed Changes

### [Web App / PWA Support]

سأقوم بتعديل ملفات الواجهة البرمجية لضمان تعرف المتصفحات على أيقونة المجلس.

#### [MODIFY] [__root.tsx](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/routes/__root.tsx)
- إضافة وسم `link` لملف `manifest.json`.
- إضافة وسم `apple-touch-icon` لضمان ظهور الشعار في الآيفون.
- إضافة وسوم `apple-mobile-web-app-capable` و `apple-mobile-web-app-status-bar-style` لتحسين تجربة المستخدم كأنه تطبيق حقيقي.

#### [MODIFY] [manifest.json](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/public/manifest.json)
- التأكد من تعيين `theme_color` و `background_color` لتتناسب مع هوية السيف الخضراء والذهبية.
- تحسين إعدادات الأيقونة لتكون `maskable` بشكل صحيح.

#### [MODIFY] [index.html](file:///C:/Projects/alsaif-legacy-nexus-b14dc257/public/index.html)
- تحديث الروابط لتتوافق مع التغييرات وضمان وجود نسخة احتياطية (Fallback).

## Verification Plan

### Manual Verification
1. فتح الموقع في متصفح Safari على iPhone واختيار "Add to Home Screen" والتأكد من ظهور الشعار.
2. فتح الموقع في متصفح Chrome على Android واختيار "Install App" أو "Add to Home Screen" والتأكد من ظهور الشعار بشكل متناسق.
3. التأكد من أن لون شريط الحالة (Status Bar) يتغير للون الأخضر الداكن الخاص بالهوية عند فتح التطبيق من الاختصار.
