CREATE OR REPLACE FUNCTION public.is_guest(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'guest'
  )
$function$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.add_conversation_creator()',
    'public.after_message_insert()',
    'public.archive_cleanup_expired()',
    'public.archive_enforce_expiry()',
    'public.bank_transfer_on_approve()',
    'public.call_send_push(text,text,text,uuid)',
    'public.log_role_change()',
    'public.log_section_head_change()',
    'public.notify_family_occasion()',
    'public.notify_meeting_created()',
    'public.notify_membership_request()',
    'public.notify_message_created()',
    'public.notify_task_created()',
    'public.notify_trip_created()',
    'public.prevent_duplicate_fund_tx()',
    'public.profiles_auto_link_parent()',
    'public.profiles_lock_identity_fields()',
    'public.update_updated_at_column()',
    'public.touch_updated_at()',
    'public.log_admin_action(text,uuid,jsonb)',
    'public.get_my_profile()',
    'public.count_fcm_tokens()',
    'public.find_or_create_direct(uuid)',
    'public.can_user_send(uuid,uuid)',
    'public.is_conversation_admin(uuid,uuid)',
    'public.is_conversation_member(uuid,uuid)',
    'public.review_profile_change_request(uuid,boolean,text)',
    'public.submit_profile_change_request(jsonb,text)',
    'public.normalize_section(text)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, supabase_auth_admin;