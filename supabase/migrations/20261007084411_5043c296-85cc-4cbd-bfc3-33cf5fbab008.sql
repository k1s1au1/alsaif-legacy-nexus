DO $$ DECLARE v_def text; v_name text; BEGIN
FOREACH v_name IN ARRAY ARRAY['public.call_send_push(text,text,text,uuid)', 'public.call_send_push_users(text,text,text,uuid[])'] LOOP
v_def:=pg_get_functiondef(v_name::regprocedure);
v_def:=replace(v_def, '''image'', public.push_content_for_url(_url,_body)->>''image''', '''image'', public.push_content_for_url(_url,_body)->>''image'', ''data'', jsonb_strip_nulls(jsonb_build_object(''image'',public.push_content_for_url(_url,_body)->>''image''))');
EXECUTE v_def;
END LOOP;
v_def:=pg_get_functiondef('public.notify_message_created()'::regprocedure);
v_def:=replace(v_def, '''image'', CASE WHEN NEW.kind = ''image'' THEN NEW.attachment_url ELSE NULL END,', '''image'', CASE WHEN NEW.kind = ''image'' THEN NEW.attachment_url ELSE NULL END, ''data'', CASE WHEN NEW.kind = ''image'' THEN jsonb_build_object(''image'',NEW.attachment_url) ELSE ''{}''::jsonb END,');
EXECUTE v_def;
END $$;