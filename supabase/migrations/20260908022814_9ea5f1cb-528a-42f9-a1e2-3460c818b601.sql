REVOKE ALL ON FUNCTION public.call_send_push_users(text,text,text,uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_private_event_invitee() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_send_push_users(text,text,text,uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_private_event_invitee() TO service_role;