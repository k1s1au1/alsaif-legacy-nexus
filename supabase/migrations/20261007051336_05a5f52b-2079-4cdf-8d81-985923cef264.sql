DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.notify_family_occasion()'::regprocedure);
  EXECUTE replace(d, '''/family-occasions''', '''/family-occasions?focus=''||NEW.id::text');
  d := pg_get_functiondef('public.notify_meeting_created()'::regprocedure);
  EXECUTE replace(d, '''/meetings''', '''/meetings?focus=''||NEW.id::text');
  d := pg_get_functiondef('public.notify_member_post_created()'::regprocedure);
  EXECUTE replace(d, '''/community''', '''/community?post=''||NEW.id::text');
  d := pg_get_functiondef('public.notify_private_event_invitee()'::regprocedure);
  EXECUTE replace(d, '''/family-occasions''', '''/family-occasions?focus=''||NEW.event_id::text');
  d := pg_get_functiondef('public.notify_private_request_created()'::regprocedure);
  EXECUTE replace(d, '''/community?view=requests''', '''/community?request=''||NEW.id::text');
  d := pg_get_functiondef('public.notify_private_request_reply()'::regprocedure);
  EXECUTE replace(d, '''/community?view=requests''', '''/community?request=''||NEW.request_id::text');
  d := pg_get_functiondef('public.notify_task_created()'::regprocedure);
  EXECUTE replace(d, '''/tasks''', '''/tasks?focus=''||NEW.id::text');
END $$;