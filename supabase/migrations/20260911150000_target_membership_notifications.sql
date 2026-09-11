-- Membership requests are private administrative events, never a broadcast.
-- Use one database-triggered delivery for web, native, and older clients.
CREATE OR REPLACE FUNCTION public.notify_membership_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reviewers uuid[];
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(DISTINCT user_id ORDER BY user_id)
    INTO v_reviewers
  FROM public.user_roles
  WHERE role IN ('chairman', 'vice_chairman');

  -- An empty recipient list must never fall back to sending to everyone.
  IF COALESCE(cardinality(v_reviewers), 0) = 0 THEN
    RETURN NEW;
  END IF;

  PERFORM public.call_send_push_users(
    '👤 طلب عضوية جديد',
    'تقدم ' || COALESCE(NEW.first_name, 'عضو') || ' بطلب انضمام. يرجى المراجعة.',
    '/admin',
    v_reviewers
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_membership_request error: %', SQLERRM;
  RETURN NEW;
END;
$function$;
