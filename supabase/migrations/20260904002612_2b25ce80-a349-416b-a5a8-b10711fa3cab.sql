-- 1) Administrative archive visibility
DROP POLICY IF EXISTS "Authenticated members can view archive" ON public.archive_items;

CREATE POLICY "View archive by section rules"
ON public.archive_items FOR SELECT TO authenticated
USING (
  section = 'family'::archive_section
  OR auth.uid() = uploader_id
  OR public.is_council_leadership(auth.uid())
  OR public.manages_section(auth.uid(), section::text)
);

-- 2) Family occasion notifications: never blast private events
CREATE OR REPLACE FUNCTION public.notify_family_occasion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.visibility = 'private'::event_visibility THEN
    RETURN NEW;
  END IF;

  PERFORM public.call_send_push(
    CASE WHEN NEW.visibility = 'official'::event_visibility
      THEN 'مناسبة عائلة السيف'
      ELSE '🎉 مناسبة عائلية جديدة' END,
    COALESCE(NEW.title,'تم إضافة مناسبة عائلية'),
    '/family-occasions',
    NEW.created_by
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_family_occasion error: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 3) member_posts: requests are no longer public posts
UPDATE public.member_posts SET kind = 'diary' WHERE kind = 'request';
ALTER TABLE public.member_posts DROP CONSTRAINT IF EXISTS member_posts_kind_check;
ALTER TABLE public.member_posts
  ADD CONSTRAINT member_posts_kind_check
  CHECK (kind IN ('diary','photo','question','poll'));

-- 4) Restrict role helper execution to authenticated/service_role
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.is_chairman(uuid)',
    'public.is_vice_chairman(uuid)',
    'public.is_technical_admin(uuid)',
    'public.is_council_leadership(uuid)',
    'public.is_guest(uuid)',
    'public.manages_section(uuid, text)',
    'public.can_manage_section(uuid, text)',
    'public.can_manage_roles(uuid)',
    'public.can_create_official_occasion(uuid)',
    'public.can_view_event(uuid, uuid)',
    'public.can_view_private_request(uuid, uuid)',
    'public.get_member_phone(uuid)',
    'public.assign_user_role(uuid, app_role)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;