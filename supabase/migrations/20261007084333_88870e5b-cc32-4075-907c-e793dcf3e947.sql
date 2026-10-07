CREATE OR REPLACE FUNCTION public.push_content_for_url(_url text, _fallback text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_text text := _fallback; v_image text; v_parts text[];
BEGIN
  v_parts := regexp_match(COALESCE(_url,''), '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})');
  IF v_parts IS NULL THEN RETURN jsonb_build_object('body',v_text); END IF;
  v_id := v_parts[1]::uuid;
  IF _url LIKE '/family-occasions?focus=%' THEN
    SELECT concat_ws(E'\n', title, nullif(description,'')), cover_image_url INTO v_text, v_image FROM public.events WHERE id=v_id;
  ELSIF _url LIKE '/community?post=%' THEN
    SELECT concat_ws(E'\n', title, nullif(body,'')), image_urls[1] INTO v_text, v_image FROM public.member_posts WHERE id=v_id;
  ELSIF _url LIKE '/trips/%' THEN
    SELECT concat_ws(E'\n', title, nullif(description,'')), image_url INTO v_text, v_image FROM public.trips WHERE id=v_id;
  ELSIF _url LIKE '/meetings?focus=%' THEN
    SELECT concat_ws(E'\n', title, nullif(description,'')) INTO v_text FROM public.meetings WHERE id=v_id;
  ELSIF _url LIKE '/tasks?focus=%' THEN
    SELECT concat_ws(E'\n', title, nullif(description,'')) INTO v_text FROM public.tasks WHERE id=v_id;
  ELSIF _url LIKE '/community?request=%' THEN
    SELECT concat_ws(E'\n', title, nullif(body,'')) INTO v_text FROM public.private_requests WHERE id=v_id;
  END IF;
  RETURN jsonb_strip_nulls(jsonb_build_object('body',coalesce(v_text,_fallback),'image',nullif(v_image,'')));
END; $$;
REVOKE ALL ON FUNCTION public.push_content_for_url(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_content_for_url(text,text) TO service_role;

DO $$ DECLARE v_def text; v_name text; BEGIN
  FOREACH v_name IN ARRAY ARRAY['public.call_send_push(text,text,text,uuid)', 'public.call_send_push_users(text,text,text,uuid[])'] LOOP
    v_def := pg_get_functiondef(v_name::regprocedure);
    v_def := replace(v_def, '''body'', _body', '''body'', coalesce(public.push_content_for_url(_url,_body)->>''body'',_body), ''image'', public.push_content_for_url(_url,_body)->>''image''');
    EXECUTE v_def;
  END LOOP;
  v_def := pg_get_functiondef('public.notify_message_created()'::regprocedure);
  v_def := replace(v_def, 'LEFT(COALESCE(NEW.body,''''), 100)', 'COALESCE(NEW.body,'''')');
  v_def := replace(v_def, '''body'', v_preview,', '''body'', v_preview, ''image'', CASE WHEN NEW.kind = ''image'' THEN NEW.attachment_url ELSE NULL END,');
  EXECUTE v_def;
  v_def := pg_get_functiondef('public.notify_task_created()'::regprocedure);
  v_def := replace(v_def, 'COALESCE(NEW.title, ''تم إسناد مهمة جديدة إليك'')', 'concat_ws(E''\n'', COALESCE(NEW.title, ''تم إسناد مهمة جديدة إليك''), nullif(NEW.description,''''))');
  EXECUTE v_def;
END $$;

CREATE OR REPLACE FUNCTION public.notify_private_request_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT author_id, title INTO r FROM public.private_requests WHERE id=NEW.request_id;
  IF r.author_id IS NULL OR r.author_id=NEW.sender_id THEN RETURN NEW; END IF;
  IF NOT (public.has_role(NEW.sender_id,'chairman') OR public.has_role(NEW.sender_id,'vice_chairman')) THEN RETURN NEW; END IF;
  -- Pass reply text directly rather than replacing it with the original request body.
  DECLARE v_def text; v_endpoint text; v_key text;
  BEGIN
    v_def := pg_get_functiondef('public.call_send_push(text,text,text,uuid)'::regprocedure);
    v_key := (regexp_match(v_def, 'v_key text := ''([^'']+)'''))[1];
    v_endpoint := (regexp_match(v_def, 'v_endpoint text := ''([^'']+)'''))[1];
    IF v_key IS NULL OR v_endpoint IS NULL THEN RETURN NEW; END IF;
    PERFORM net.http_post(url:=v_endpoint,
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
      body:=jsonb_build_object('title','💬 رد على طلبك الخاص','body',concat_ws(E'\n',r.title,NEW.body),'url','/community?request='||NEW.request_id::text,'user_ids',jsonb_build_array(r.author_id)));
  END;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE LOG 'notify_private_request_reply: %',SQLERRM; RETURN NEW;
END $$;