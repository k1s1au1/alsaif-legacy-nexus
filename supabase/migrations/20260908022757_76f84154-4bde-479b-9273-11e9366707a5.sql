-- Targeted push helper: notify specific users only
CREATE OR REPLACE FUNCTION public.call_send_push_users(_title text, _body text, _url text, _user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_endpoint text := 'https://wzgzkyzpzniduwcgdozl.supabase.co/functions/v1/send-push';
  v_key text;
BEGIN
  IF _user_ids IS NULL OR array_length(_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  v_key := (regexp_match(
    pg_get_functiondef('public.call_send_push(text,text,text,uuid)'::regprocedure),
    'v_key text := ''([^'']+)'''
  ))[1];

  IF v_key IS NULL THEN
    RAISE LOG 'call_send_push_users: missing key';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := jsonb_build_object('title', _title, 'body', _body, 'url', _url, 'user_ids', to_jsonb(_user_ids))
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.call_send_push_users(text,text,text,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.call_send_push_users(text,text,text,uuid[]) TO service_role;

-- Notify only newly added invitees of a private occasion
CREATE OR REPLACE FUNCTION public.notify_private_event_invitee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event public.events;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = NEW.event_id;
  IF v_event.id IS NULL THEN RETURN NEW; END IF;
  IF v_event.visibility <> 'private'::event_visibility THEN RETURN NEW; END IF;
  IF NEW.user_id = v_event.created_by THEN RETURN NEW; END IF;

  PERFORM public.call_send_push_users(
    'دعوة لمناسبة خاصة',
    COALESCE(v_event.title, 'تمت دعوتك لمناسبة خاصة'),
    '/family-occasions',
    ARRAY[NEW.user_id]
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_private_event_invitee error: %', SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_private_event_invitee_trg ON public.event_invitees;
CREATE TRIGGER notify_private_event_invitee_trg
AFTER INSERT ON public.event_invitees
FOR EACH ROW EXECUTE FUNCTION public.notify_private_event_invitee();