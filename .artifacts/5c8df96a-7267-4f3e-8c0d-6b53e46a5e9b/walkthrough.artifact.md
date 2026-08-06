# ملخص تنفيذ نظام التصاريح الديناميكي للضيوف 🔑🛡️

تم الانتهاء من تحويل حساب الضيف إلى نظام "ديناميكي" بالكامل، حيث يمكنك الآن تحديد الأقسام المسموح لكل ضيف برؤيتها بشكل منفصل.

## التغييرات التي تم إجراؤها

### 1. لوحة إدارة ذكية (Admin Panel)
*   **تصاريح الدخول:** عند اختيار رتبة "ضيف المجلس" لأي عضو، ستظهر لك تلقائياً قائمة بالأقسام (الشجرة، المالية، الدردشة، إلخ).
*   **تحكم لحظي:** يمكنك تفعيل أو إلغاء تفعيل أي قسم بضغطة زر، وسيتم حفظ التعديل فوراً في قاعدة البيانات.

### 2. نظام حماية مرن (Dynamic Access Control)
*   **فلترة القوائم:** القائمة الجانبية والشريط السفلي في تطبيق الجوال سيظهران للضيف **فقط** الأقسام التي سمحت له بها.
*   **منع الوصول المباشر:** إذا حاول الضيف الدخول لقسم غير مصرح به (عبر الرابط المباشر)، ستظهر له رسالة "خاص بالعائلة" وسيُمنع من رؤية البيانات.

### 3. أمان البيانات (RLS)
*   تم تحديث سياسات الأمان في قاعدة البيانات لتكون مرتبطة بقائمة الأقسام المسموحة لكل مستخدم، مما يضمن استحالة تسرب البيانات حتى في حال محاولة الاختراق التقني.

---

> [!IMPORTANT]
> **الخطوة الأخيرة لتفعيل النظام:**
> يرجى تشغيل الكود التالي في **SQL Editor** في Supabase لإنشاء عمود الصلاحيات الجديد وتحديث الحماية:
> ```sql
> -- 1. إضافة عمود الأقسام المسموحة لجدول profiles
> ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allowed_sections JSONB DEFAULT '[]'::jsonb;
>
> -- 2. تحديث دالة التحقق لتشمل الأقسام
> CREATE OR REPLACE FUNCTION public.can_access_section(_user_id UUID, _section TEXT)
> RETURNS BOOLEAN AS $$
> DECLARE
>     v_role public.app_role;
>     v_allowed JSONB;
> BEGIN
>     SELECT role INTO v_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
>     SELECT allowed_sections INTO v_allowed FROM public.profiles WHERE id = _user_id;
>     IF v_role IN ('admin', 'chairman', 'manager', 'member') THEN RETURN TRUE; END IF;
>     IF v_role = 'guest' THEN RETURN (v_allowed ? _section); END IF;
>     RETURN FALSE;
> END;
> $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
>
> -- 3. تطبيق الحماية على الجداول الحساسة
> DROP POLICY IF EXISTS "All members view transfers" ON public.bank_transfers;
> CREATE POLICY "All members view transfers" ON public.bank_transfers
> FOR SELECT TO authenticated USING (public.can_access_section(auth.uid(), 'finance'));
>
> DROP POLICY IF EXISTS "All members view vault" ON public.secure_vault;
> CREATE POLICY "All members view vault" ON public.secure_vault
> FOR SELECT TO authenticated USING (public.can_access_section(auth.uid(), 'vault'));
> ```

---

> [!TIP]
> **كيف تستخدم النظام الجديد؟**
> 1. اذهب لـ **الإدارة** -> **إدارة الأعضاء**.
> 2. ابحث عن ضيف واضغط على زر **"ضيف المجلس"**.
> 3. ستظهر لك قائمة أقسام باللون الرمادي، اضغط على الأقسام التي تريد من الضيف رؤيتها (ستتحول للون الأسود والأخضر).
> 4. سيتم الحفظ تلقائياً!

render_diffs(file:///C:/Projects/alsaif-legacy-nexus-b14dc257/supabase/migrations/20260806170600_dynamic_guest_permissions.sql)
render_diffs(file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/routes/_authenticated/admin.tsx)
render_diffs(file:///C:/Projects/alsaif-legacy-nexus-b14dc257/src/components/app-shell.tsx)
