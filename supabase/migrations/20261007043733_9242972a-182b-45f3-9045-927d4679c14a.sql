CREATE OR REPLACE FUNCTION public.notify_member_post_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.call_send_push('📝 ركن الأعضاء', COALESCE(NEW.title, 'مشاركة جديدة'), '/community', NEW.author_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE LOG 'notify_member_post_created: %', SQLERRM; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_member_post_created_trg ON public.member_posts;
CREATE TRIGGER notify_member_post_created_trg AFTER INSERT ON public.member_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_member_post_created();

CREATE OR REPLACE FUNCTION public.notify_private_request_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v uuid[];
BEGIN
  SELECT array_agg(DISTINCT user_id) INTO v FROM public.user_roles
  WHERE (role = 'chairman' OR (NEW.visibility = 'leadership' AND role = 'vice_chairman'))
    AND user_id <> NEW.author_id;
  IF COALESCE(cardinality(v),0) = 0 THEN RETURN NEW; END IF;
  PERFORM public.call_send_push_users('🔒 طلب خاص جديد', COALESCE(NEW.title,'طلب جديد'), '/community?view=requests', v);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE LOG 'notify_private_request_created: %', SQLERRM; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_private_request_created_trg ON public.private_requests;
CREATE TRIGGER notify_private_request_created_trg AFTER INSERT ON public.private_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_private_request_created();

CREATE OR REPLACE FUNCTION public.notify_private_request_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  SELECT author_id, title INTO r FROM public.private_requests WHERE id = NEW.request_id;
  IF r.author_id IS NULL OR r.author_id = NEW.sender_id THEN RETURN NEW; END IF;
  IF NOT (public.has_role(NEW.sender_id,'chairman') OR public.has_role(NEW.sender_id,'vice_chairman')) THEN RETURN NEW; END IF;
  PERFORM public.call_send_push_users('💬 رد على طلبك الخاص', 'تم الرد على طلبك: ' || COALESCE(r.title,''), '/community?view=requests', ARRAY[r.author_id]);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE LOG 'notify_private_request_reply: %', SQLERRM; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_private_request_reply_trg ON public.private_request_messages;
CREATE TRIGGER notify_private_request_reply_trg AFTER INSERT ON public.private_request_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_private_request_reply();

REVOKE ALL ON FUNCTION public.notify_member_post_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_private_request_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_private_request_reply() FROM PUBLIC, anon, authenticated;