-- ============ 1) HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.normalize_section(_s text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE lower(btrim(coalesce(_s,'')))
    WHEN 'events' THEN 'occasions'
    WHEN 'occasion' THEN 'occasions'
    WHEN 'majlis' THEN 'news'
    WHEN 'family_tree' THEN 'heritage'
    WHEN 'legacy' THEN 'heritage'
    ELSE lower(btrim(coalesce(_s,'')))
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_chairman(_u uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _u AND role::text = 'chairman');
$$;

CREATE OR REPLACE FUNCTION public.is_vice_chairman(_u uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _u AND role::text = 'vice_chairman');
$$;

CREATE OR REPLACE FUNCTION public.is_technical_admin(_u uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _u AND role::text = 'technical_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_council_leadership(_u uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_chairman(_u) OR public.is_vice_chairman(_u);
$$;

CREATE OR REPLACE FUNCTION public.manages_section(_u uuid, _section text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.section_heads sh
    WHERE sh.user_id = _u
      AND public.normalize_section(sh.section) = public.normalize_section(_section)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_section(_user uuid, _section text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_council_leadership(_user) OR public.manages_section(_user, _section);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_roles(_u uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_chairman(_u);
$$;

CREATE OR REPLACE FUNCTION public.can_create_official_occasion(_u uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_council_leadership(_u) OR public.manages_section(_u, 'occasions');
$$;

-- ============ 2) DATA MIGRATION FOR LEGACY ROLES ============
DELETE FROM public.user_roles ur
WHERE ur.role::text = 'admin'
  AND EXISTS (SELECT 1 FROM public.user_roles u2
              WHERE u2.user_id = ur.user_id AND u2.role::text = 'technical_admin');

UPDATE public.user_roles SET role = 'technical_admin'::public.app_role
WHERE role::text = 'admin';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, arabic_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'arabic_name')
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'chairman');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member')
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_user_role(_user_id uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT public.is_chairman(v_actor) THEN
    RAISE EXCEPTION 'رئيس المجلس فقط يمكنه تعديل الرتب';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'العضو غير موجود';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role <> _role;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_phone(_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT phone FROM public.profiles
  WHERE id = _user
    AND (auth.uid() = _user OR public.is_council_leadership(auth.uid()));
$$;

-- ============ 3) COLUMN-LEVEL PRIVACY ON PROFILES ============
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, arabic_name, avatar_url, is_active, created_at, updated_at,
  first_name, father_name, grandfather_name, parent_id, terms_accepted_at,
  bottom_nav_prefs, allowed_sections, theme_color, gender, birth_calendar,
  birth_date, birth_date_hijri) ON public.profiles TO authenticated;

-- ============ 4) REWRITE LEGACY POLICIES ============
-- account_requests (leadership)
DROP POLICY IF EXISTS "Privileged users can view account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Privileged users can update account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Privileged users can delete account requests" ON public.account_requests;
CREATE POLICY "Leadership can view account requests" ON public.account_requests
  FOR SELECT TO authenticated USING (public.is_council_leadership(auth.uid()));
CREATE POLICY "Leadership can update account requests" ON public.account_requests
  FOR UPDATE TO authenticated USING (public.is_council_leadership(auth.uid()))
  WITH CHECK (public.is_council_leadership(auth.uid()));
CREATE POLICY "Chairman can delete account requests" ON public.account_requests
  FOR DELETE TO authenticated USING (public.is_chairman(auth.uid()));

-- admin_activity_log (read-only audit)
DROP POLICY IF EXISTS "Admins read activity log" ON public.admin_activity_log;
CREATE POLICY "Leadership reads audit log" ON public.admin_activity_log
  FOR SELECT TO authenticated USING (public.is_council_leadership(auth.uid()));

-- anonymous_suggestions (leadership)
DROP POLICY IF EXISTS "Management can read suggestions" ON public.anonymous_suggestions;
DROP POLICY IF EXISTS "Management can update suggestions" ON public.anonymous_suggestions;
DROP POLICY IF EXISTS "Management can delete suggestions" ON public.anonymous_suggestions;
CREATE POLICY "Leadership can read suggestions" ON public.anonymous_suggestions
  FOR SELECT TO authenticated USING (public.is_council_leadership(auth.uid()));
CREATE POLICY "Leadership can update suggestions" ON public.anonymous_suggestions
  FOR UPDATE TO authenticated USING (public.is_council_leadership(auth.uid()))
  WITH CHECK (public.is_council_leadership(auth.uid()));
CREATE POLICY "Chairman can delete suggestions" ON public.anonymous_suggestions
  FOR DELETE TO authenticated USING (public.is_chairman(auth.uid()));

-- app_settings (technical + chairman)
DROP POLICY IF EXISTS "admins manage settings insert" ON public.app_settings;
DROP POLICY IF EXISTS "admins manage settings update" ON public.app_settings;
DROP POLICY IF EXISTS "admins manage settings delete" ON public.app_settings;
CREATE POLICY "Technical or chairman insert settings" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_technical_admin(auth.uid()) OR public.is_chairman(auth.uid()));
CREATE POLICY "Technical or chairman update settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.is_technical_admin(auth.uid()) OR public.is_chairman(auth.uid()))
  WITH CHECK (public.is_technical_admin(auth.uid()) OR public.is_chairman(auth.uid()));
CREATE POLICY "Technical or chairman delete settings" ON public.app_settings
  FOR DELETE TO authenticated
  USING (public.is_technical_admin(auth.uid()) OR public.is_chairman(auth.uid()));

-- archive_items (section based writes; reads stay open to members)
DROP POLICY IF EXISTS "Insert archive items by section rules" ON public.archive_items;
DROP POLICY IF EXISTS "Update archive items by section rules" ON public.archive_items;
DROP POLICY IF EXISTS "Delete archive items by section rules" ON public.archive_items;
CREATE POLICY "Insert archive items by section rules" ON public.archive_items
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = uploader_id AND (
      section = 'family'::archive_section
      OR public.can_manage_section(auth.uid(), section::text)
    ));
CREATE POLICY "Update archive items by section rules" ON public.archive_items
  FOR UPDATE TO authenticated USING (
    (section = 'family'::archive_section AND auth.uid() = uploader_id)
    OR public.can_manage_section(auth.uid(), section::text)
  ) WITH CHECK (
    (section = 'family'::archive_section AND auth.uid() = uploader_id)
    OR public.can_manage_section(auth.uid(), section::text)
  );
CREATE POLICY "Delete archive items by section rules" ON public.archive_items
  FOR DELETE TO authenticated USING (
    (section = 'family'::archive_section AND auth.uid() = uploader_id)
    OR public.can_manage_section(auth.uid(), section::text)
  );

-- bug_reports (technical + leadership)
DROP POLICY IF EXISTS "admins and chairman can view all bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "admins and chairman can update bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "admins and chairman can delete bug reports" ON public.bug_reports;
CREATE POLICY "Technical or leadership view bug reports" ON public.bug_reports
  FOR SELECT TO authenticated
  USING (public.is_technical_admin(auth.uid()) OR public.is_council_leadership(auth.uid()));
CREATE POLICY "Technical or leadership update bug reports" ON public.bug_reports
  FOR UPDATE TO authenticated
  USING (public.is_technical_admin(auth.uid()) OR public.is_council_leadership(auth.uid()))
  WITH CHECK (public.is_technical_admin(auth.uid()) OR public.is_council_leadership(auth.uid()));
CREATE POLICY "Technical or leadership delete bug reports" ON public.bug_reports
  FOR DELETE TO authenticated
  USING (public.is_technical_admin(auth.uid()) OR public.is_council_leadership(auth.uid()));

-- family_projects / contributions (finance + leadership)
DROP POLICY IF EXISTS "Chairman/admin can update projects" ON public.family_projects;
DROP POLICY IF EXISTS "Proposer can delete pending or admins anytime" ON public.family_projects;
CREATE POLICY "Leadership or finance update projects" ON public.family_projects
  FOR UPDATE TO authenticated
  USING (public.can_manage_section(auth.uid(), 'finance'))
  WITH CHECK (public.can_manage_section(auth.uid(), 'finance'));
CREATE POLICY "Proposer pending or leadership delete projects" ON public.family_projects
  FOR DELETE TO authenticated USING (
    (proposed_by = auth.uid() AND status = 'pending'::family_project_status)
    OR public.can_manage_section(auth.uid(), 'finance')
  );
DROP POLICY IF EXISTS "Owner or admin can delete contribution" ON public.family_project_contributions;
CREATE POLICY "Owner or finance delete contribution" ON public.family_project_contributions
  FOR DELETE TO authenticated USING (
    contributor_id = auth.uid() OR public.can_manage_section(auth.uid(), 'finance'));

-- family_tree_extras => heritage section
DROP POLICY IF EXISTS "Admins and managers manage extras" ON public.family_tree_extras;
CREATE POLICY "Heritage managers manage extras" ON public.family_tree_extras
  FOR ALL TO authenticated
  USING (public.can_manage_section(auth.uid(), 'heritage'))
  WITH CHECK (public.can_manage_section(auth.uid(), 'heritage'));

-- majlis (news section)
DROP POLICY IF EXISTS "Read posts (complaints restricted)" ON public.majlis_posts;
DROP POLICY IF EXISTS "Insert posts by kind" ON public.majlis_posts;
DROP POLICY IF EXISTS "Author or admin/manager can update posts" ON public.majlis_posts;
DROP POLICY IF EXISTS "Author or admin/manager can delete posts" ON public.majlis_posts;
CREATE POLICY "Read majlis posts" ON public.majlis_posts
  FOR SELECT TO authenticated USING (
    kind <> 'complaint'::majlis_post_kind
    OR author_id = auth.uid()
    OR public.is_council_leadership(auth.uid())
  );
CREATE POLICY "Insert majlis posts by kind" ON public.majlis_posts
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid() AND (
      kind IN ('complaint'::majlis_post_kind, 'discussion'::majlis_post_kind)
      OR public.can_manage_section(auth.uid(), 'news')
    ));
CREATE POLICY "Author or news manager update posts" ON public.majlis_posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.can_manage_section(auth.uid(), 'news'));
CREATE POLICY "Author or news manager delete posts" ON public.majlis_posts
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.can_manage_section(auth.uid(), 'news'));

DROP POLICY IF EXISTS "Read comments (complaints restricted)" ON public.majlis_comments;
DROP POLICY IF EXISTS "Author or admin/manager can update comments" ON public.majlis_comments;
DROP POLICY IF EXISTS "Author or admin/manager can delete comments" ON public.majlis_comments;
CREATE POLICY "Read majlis comments" ON public.majlis_comments
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.majlis_posts p WHERE p.id = majlis_comments.post_id AND (
      p.kind <> 'complaint'::majlis_post_kind
      OR p.author_id = auth.uid()
      OR public.is_council_leadership(auth.uid()))));
CREATE POLICY "Author or news manager update comments" ON public.majlis_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.can_manage_section(auth.uid(), 'news'));
CREATE POLICY "Author or news manager delete comments" ON public.majlis_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.can_manage_section(auth.uid(), 'news'));

-- profiles administration
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Leadership manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_council_leadership(auth.uid()))
  WITH CHECK (public.is_council_leadership(auth.uid()));

-- profile_change_requests
DROP POLICY IF EXISTS "own or admin can view change requests" ON public.profile_change_requests;
DROP POLICY IF EXISTS "admins can review change requests" ON public.profile_change_requests;
DROP POLICY IF EXISTS "own pending or admin can delete change request" ON public.profile_change_requests;
CREATE POLICY "own or leadership view change requests" ON public.profile_change_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_council_leadership(auth.uid()));
CREATE POLICY "leadership review change requests" ON public.profile_change_requests
  FOR UPDATE TO authenticated
  USING (public.is_council_leadership(auth.uid()))
  WITH CHECK (public.is_council_leadership(auth.uid()));
CREATE POLICY "own pending or leadership delete change request" ON public.profile_change_requests
  FOR DELETE TO authenticated USING (
    (user_id = auth.uid() AND status = 'pending') OR public.is_council_leadership(auth.uid()));

CREATE OR REPLACE FUNCTION public.review_profile_change_request(_id uuid, _approve boolean, _note text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.profile_change_requests;
  v_c jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_council_leadership(v_uid) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية مراجعة الطلبات';
  END IF;

  SELECT * INTO v_req FROM public.profile_change_requests WHERE id = _id;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'تمت مراجعة هذا الطلب مسبقاً'; END IF;

  IF _approve THEN
    v_c := v_req.changes;
    PERFORM set_config('app.apply_profile_change', 'on', true);
    UPDATE public.profiles SET
      arabic_name      = CASE WHEN v_c ? 'arabic_name' THEN NULLIF(v_c->>'arabic_name','') ELSE arabic_name END,
      full_name        = CASE WHEN v_c ? 'full_name' THEN NULLIF(v_c->>'full_name','') ELSE full_name END,
      first_name       = CASE WHEN v_c ? 'first_name' THEN NULLIF(v_c->>'first_name','') ELSE first_name END,
      father_name      = CASE WHEN v_c ? 'father_name' THEN NULLIF(v_c->>'father_name','') ELSE father_name END,
      grandfather_name = CASE WHEN v_c ? 'grandfather_name' THEN NULLIF(v_c->>'grandfather_name','') ELSE grandfather_name END,
      gender           = CASE WHEN v_c ? 'gender' THEN NULLIF(v_c->>'gender','')::public.gender_type ELSE gender END,
      birth_calendar   = CASE WHEN v_c ? 'birth_calendar' THEN COALESCE(NULLIF(v_c->>'birth_calendar',''), birth_calendar) ELSE birth_calendar END,
      birth_date       = CASE WHEN v_c ? 'birth_date' THEN NULLIF(v_c->>'birth_date','')::date ELSE birth_date END,
      birth_date_hijri = CASE WHEN v_c ? 'birth_date_hijri' THEN NULLIF(v_c->>'birth_date_hijri','') ELSE birth_date_hijri END
    WHERE id = v_req.user_id;
    PERFORM set_config('app.apply_profile_change', 'off', true);
  END IF;

  UPDATE public.profile_change_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = v_uid, reviewed_at = now(),
      review_note = NULLIF(btrim(COALESCE(_note,'')), '')
  WHERE id = _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_lock_identity_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_onboarding_incomplete boolean;
BEGIN
  IF v_uid IS NULL
     OR public.is_council_leadership(v_uid)
     OR current_setting('app.apply_profile_change', true) = 'on'
  THEN RETURN NEW; END IF;

  v_onboarding_incomplete :=
    OLD.gender IS NULL
    OR (OLD.birth_date IS NULL AND OLD.birth_date_hijri IS NULL)
    OR OLD.first_name IS NULL OR OLD.father_name IS NULL OR OLD.grandfather_name IS NULL;
  IF v_onboarding_incomplete THEN RETURN NEW; END IF;

  IF NEW.arabic_name IS DISTINCT FROM OLD.arabic_name
     OR NEW.full_name IS DISTINCT FROM OLD.full_name
     OR NEW.first_name IS DISTINCT FROM OLD.first_name
     OR NEW.father_name IS DISTINCT FROM OLD.father_name
     OR NEW.grandfather_name IS DISTINCT FROM OLD.grandfather_name THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل الاسم موافقة الإدارة';
  END IF;
  IF NEW.gender IS DISTINCT FROM OLD.gender THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل الجنس موافقة الإدارة';
  END IF;
  IF NEW.birth_date IS DISTINCT FROM OLD.birth_date
     OR NEW.birth_date_hijri IS DISTINCT FROM OLD.birth_date_hijri
     OR NEW.birth_calendar IS DISTINCT FROM OLD.birth_calendar THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل تاريخ الميلاد موافقة الإدارة';
  END IF;
  RETURN NEW;
END;
$$;

-- tasks (tasks section)
DROP POLICY IF EXISTS "Authorized users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authorized users can delete tasks" ON public.tasks;
CREATE POLICY "Authorized users can update tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (
    auth.uid() = created_by OR auth.uid() = assignee_id
    OR public.can_manage_section(auth.uid(), 'tasks'));
CREATE POLICY "Authorized users can delete tasks" ON public.tasks
  FOR DELETE TO authenticated USING (
    auth.uid() = created_by OR public.can_manage_section(auth.uid(), 'tasks'));

-- user_roles (chairman only)
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Privileged users can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Privileged users can delete roles" ON public.user_roles;
CREATE POLICY "Chairman inserts roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_chairman(auth.uid()));
CREATE POLICY "Chairman updates roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.is_chairman(auth.uid()))
  WITH CHECK (public.is_chairman(auth.uid()));
CREATE POLICY "Chairman deletes roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_chairman(auth.uid()) AND role::text <> 'chairman');

-- section_heads (chairman + vice chairman)
DROP POLICY IF EXISTS "Only chairman manages section heads" ON public.section_heads;
CREATE POLICY "Leadership manages section heads" ON public.section_heads
  FOR ALL TO authenticated
  USING (public.is_council_leadership(auth.uid()))
  WITH CHECK (public.is_council_leadership(auth.uid()));

-- ============ 5) OCCASION VISIBILITY ============
DO $$ BEGIN
  CREATE TYPE public.event_visibility AS ENUM ('public','private','official');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility public.event_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

UPDATE public.events SET visibility = 'official' WHERE visibility = 'public';

CREATE TABLE IF NOT EXISTS public.event_invitees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invitees TO authenticated;
GRANT ALL ON public.event_invitees TO service_role;
ALTER TABLE public.event_invitees ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_event(_u uuid, _event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = _event AND (
      e.visibility <> 'private'
      OR e.created_by = _u
      OR public.is_council_leadership(_u)
      OR EXISTS (SELECT 1 FROM public.event_invitees i WHERE i.event_id = e.id AND i.user_id = _u)
    ));
$$;

DROP POLICY IF EXISTS "Authenticated can view events" ON public.events;
DROP POLICY IF EXISTS "Event managers can insert" ON public.events;
DROP POLICY IF EXISTS "Event managers can update" ON public.events;
DROP POLICY IF EXISTS "Event managers can delete" ON public.events;
CREATE POLICY "View events by visibility" ON public.events
  FOR SELECT TO authenticated USING (
    visibility <> 'private'
    OR created_by = auth.uid()
    OR public.is_council_leadership(auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_invitees i WHERE i.event_id = events.id AND i.user_id = auth.uid())
  );
CREATE POLICY "Members create occasions" ON public.events
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND (
      visibility IN ('public','private')
      OR public.can_create_official_occasion(auth.uid())
    ));
CREATE POLICY "Owner or occasion manager update" ON public.events
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.can_manage_section(auth.uid(), 'occasions'))
  WITH CHECK (
    (visibility <> 'official' AND created_by = auth.uid())
    OR public.can_create_official_occasion(auth.uid()));
CREATE POLICY "Owner or occasion manager delete" ON public.events
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.can_manage_section(auth.uid(), 'occasions'));

CREATE POLICY "View invitees of viewable events" ON public.event_invitees
  FOR SELECT TO authenticated USING (public.can_view_event(auth.uid(), event_id));
CREATE POLICY "Event owner manages invitees insert" ON public.event_invitees
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid())
    OR public.can_manage_section(auth.uid(), 'occasions'));
CREATE POLICY "Event owner manages invitees delete" ON public.event_invitees
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.created_by = auth.uid())
    OR public.can_manage_section(auth.uid(), 'occasions'));

DROP POLICY IF EXISTS "Authenticated can view attendees" ON public.event_attendees;
CREATE POLICY "View attendees of viewable events" ON public.event_attendees
  FOR SELECT TO authenticated USING (public.can_view_event(auth.uid(), event_id));

-- ============ 6) PRIVATE REQUESTS ============
DO $$ BEGIN
  CREATE TYPE public.private_request_visibility AS ENUM ('leadership','chairman_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.private_request_status AS ENUM ('new','seen','in_progress','awaiting_member','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.private_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  visibility public.private_request_visibility NOT NULL DEFAULT 'leadership',
  status public.private_request_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_requests TO authenticated;
GRANT ALL ON public.private_requests TO service_role;
ALTER TABLE public.private_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.private_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.private_requests(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.private_request_messages TO authenticated;
GRANT ALL ON public.private_request_messages TO service_role;
ALTER TABLE public.private_request_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_private_request(_u uuid, _r uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.private_requests pr WHERE pr.id = _r AND (
      pr.author_id = _u
      OR (pr.visibility = 'leadership' AND public.is_council_leadership(_u))
      OR (pr.visibility = 'chairman_only' AND public.is_chairman(_u))
    ));
$$;

CREATE POLICY "View own or authorized private requests" ON public.private_requests
  FOR SELECT TO authenticated USING (
    author_id = auth.uid()
    OR (visibility = 'leadership' AND public.is_council_leadership(auth.uid()))
    OR (visibility = 'chairman_only' AND public.is_chairman(auth.uid()))
  );
CREATE POLICY "Members create own private requests" ON public.private_requests
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Author or authorized update private requests" ON public.private_requests
  FOR UPDATE TO authenticated USING (
    author_id = auth.uid()
    OR (visibility = 'leadership' AND public.is_council_leadership(auth.uid()))
    OR (visibility = 'chairman_only' AND public.is_chairman(auth.uid()))
  ) WITH CHECK (
    author_id = auth.uid()
    OR (visibility = 'leadership' AND public.is_council_leadership(auth.uid()))
    OR (visibility = 'chairman_only' AND public.is_chairman(auth.uid()))
  );
CREATE POLICY "Author new or chairman delete private requests" ON public.private_requests
  FOR DELETE TO authenticated USING (
    (author_id = auth.uid() AND status = 'new') OR public.is_chairman(auth.uid()));

CREATE POLICY "View messages of visible requests" ON public.private_request_messages
  FOR SELECT TO authenticated USING (public.can_view_private_request(auth.uid(), request_id));
CREATE POLICY "Send messages on visible requests" ON public.private_request_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND public.can_view_private_request(auth.uid(), request_id));

CREATE TRIGGER private_requests_touch BEFORE UPDATE ON public.private_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- migrate legacy member_posts requests
INSERT INTO public.private_requests (author_id, title, body, visibility, status, created_at)
SELECT mp.author_id, COALESCE(NULLIF(mp.title,''),'طلب خاص'), COALESCE(mp.body,''), 'leadership', 'new', mp.created_at
FROM public.member_posts mp
WHERE mp.kind IN ('request','private_request')
  AND NOT EXISTS (
    SELECT 1 FROM public.private_requests pr
    WHERE pr.author_id = mp.author_id AND pr.created_at = mp.created_at);
DELETE FROM public.member_post_comments c
WHERE EXISTS (SELECT 1 FROM public.member_posts mp WHERE mp.id = c.post_id AND mp.kind IN ('request','private_request'));
DELETE FROM public.member_posts WHERE kind IN ('request','private_request');

-- ============ 7) AUDIT LOG TRIGGERS ============
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_activity_log (actor_id, action, target_user_id, details)
  VALUES (
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN 'role_assigned' ELSE 'role_removed' END,
    COALESCE(NEW.user_id, OLD.user_id),
    jsonb_build_object('role', COALESCE(NEW.role, OLD.role)::text)
  );
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_section_head_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_activity_log (actor_id, action, target_user_id, details)
  VALUES (
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN 'section_assigned' ELSE 'section_removed' END,
    COALESCE(NEW.user_id, OLD.user_id),
    jsonb_build_object('section', public.normalize_section(COALESCE(NEW.section, OLD.section)))
  );
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS user_roles_audit ON public.user_roles;
CREATE TRIGGER user_roles_audit AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_role_change();

DROP TRIGGER IF EXISTS section_heads_audit ON public.section_heads;
CREATE TRIGGER section_heads_audit AFTER INSERT OR DELETE ON public.section_heads
  FOR EACH ROW EXECUTE FUNCTION public.log_section_head_change();

GRANT INSERT ON public.admin_activity_log TO service_role;

CREATE OR REPLACE FUNCTION public.log_admin_action(_action text, _target uuid DEFAULT NULL, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.admin_activity_log (actor_id, action, target_user_id, details)
  VALUES (auth.uid(), _action, _target, COALESCE(_details, '{}'::jsonb));
END;
$$;