-- 1. إضافة عمود الأقسام المسموحة لجدول profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allowed_sections JSONB DEFAULT '[]'::jsonb;

-- 2. تحديث دالة التحقق لتشمل الأقسام
CREATE OR REPLACE FUNCTION public.can_access_section(_user_id UUID, _section TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_role public.app_role;
    v_allowed JSONB;
BEGIN
    -- جلب الرتبة والأقسام المسموحة
    SELECT role INTO v_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
    SELECT allowed_sections INTO v_allowed FROM public.profiles WHERE id = _user_id;

    -- إذا كان مسؤولاً أو رئيساً أو مديراً، له الحق في كل شيء (أو حسب منطق الرتب الحالي)
    IF v_role IN ('admin', 'chairman', 'manager', 'member') THEN
        RETURN TRUE;
    END IF;

    -- إذا كان ضيفاً، نتحقق من القائمة
    IF v_role = 'guest' THEN
        RETURN (v_allowed ? _section);
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. تحديث سياسات RLS لتكون ديناميكية
-- [ملاحظة: سنقوم بتعديل السياسات التي قمنا بإنشائها سابقاً لتعتمد على الدالة الجديدة]

DROP POLICY IF EXISTS "All members view transfers" ON public.bank_transfers;
CREATE POLICY "All members view transfers" ON public.bank_transfers
FOR SELECT TO authenticated USING (public.can_access_section(auth.uid(), 'finance'));

DROP POLICY IF EXISTS "All members view vault" ON public.secure_vault;
CREATE POLICY "All members view vault" ON public.secure_vault
FOR SELECT TO authenticated USING (public.can_access_section(auth.uid(), 'vault'));

DROP POLICY IF EXISTS "Read All Tasks" ON public.tasks;
CREATE POLICY "Read All Tasks" ON public.tasks
FOR SELECT TO authenticated USING (public.can_access_section(auth.uid(), 'tasks'));

-- إضافة حماية للرسائل
DROP POLICY IF EXISTS "Participants view messages" ON public.messages;
CREATE POLICY "Participants view messages" ON public.messages
FOR SELECT TO authenticated USING (
    public.can_access_section(auth.uid(), 'chat') AND
    EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())
);
