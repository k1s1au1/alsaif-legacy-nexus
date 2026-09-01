CREATE OR REPLACE FUNCTION public.notify_membership_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admins uuid[];
BEGIN
  SELECT array_agg(DISTINCT user_id) INTO v_admins
  FROM public.user_roles
  WHERE role IN ('admin','chairman');

  IF v_admins IS NULL THEN RETURN NEW; END IF;

  PERFORM public.call_send_push(
    '👤 طلب عضوية جديد',
    'تقدم ' || COALESCE(NEW.first_name,'عضو') || ' بطلب انضمام. يرجى المراجعة.',
    '/admin',
    NULL
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_membership_request error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_membership_request ON public.account_requests;
CREATE TRIGGER trg_notify_membership_request
AFTER INSERT ON public.account_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_membership_request();

CREATE OR REPLACE FUNCTION public.notify_family_occasion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.call_send_push(
    '🎉 مناسبة عائلية جديدة',
    COALESCE(NEW.title,'تم إضافة مناسبة عائلية'),
    '/family-occasions',
    NEW.created_by
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_family_occasion error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_family_occasion ON public.events;
CREATE TRIGGER trg_notify_family_occasion
AFTER INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.notify_family_occasion();