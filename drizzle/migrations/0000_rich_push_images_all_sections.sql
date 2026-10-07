CREATE OR REPLACE FUNCTION public.occasion_push_image(_type text, _design int, _audience text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $f$
  SELECT 'https://alsaif-legacy-nexus.lovable.app' || ('{"birthday-1":"/__l5e/assets-v1/5aae4b51-2512-47fb-8331-fa1be9a688b2/push-occasion-birthday-1.jpg","birthday-2":"/__l5e/assets-v1/6c85f6c3-9761-44ef-83b7-6985c1d33790/push-occasion-birthday-2.jpg","birthday-3":"/__l5e/assets-v1/27b05463-08d0-454c-83d1-9cf0cd02f981/push-occasion-birthday-3.jpg","condolence-1":"/__l5e/assets-v1/9b3fc48d-10b6-4bee-afd3-5c108b10e742/push-occasion-condolence-1.jpg","eid-adha-1":"/__l5e/assets-v1/3e649be0-16fe-4ac7-8f0f-b96973f4bf16/push-occasion-eid-adha-1.jpg","eid-adha-2":"/__l5e/assets-v1/47ddf457-d170-4538-9875-ee6281b08ab7/push-occasion-eid-adha-2.jpg","eid-adha-3":"/__l5e/assets-v1/9427660f-7d52-4c93-95ee-6a9d5a034e98/push-occasion-eid-adha-3.jpg","eid-fitr-1":"/__l5e/assets-v1/e94f9c49-dc28-4156-a7f8-500a8a574c13/push-occasion-eid-fitr-1.jpg","eid-fitr-2":"/__l5e/assets-v1/211ab730-04a5-4eb3-b5f6-1f4802063535/push-occasion-eid-fitr-2.jpg","eid-fitr-3":"/__l5e/assets-v1/28e8437a-b011-4ba1-b104-b5a29531bda8/push-occasion-eid-fitr-3.jpg","family-gathering-1":"/__l5e/assets-v1/4f04919d-a3bd-4523-819e-7c6e43f110af/push-occasion-family-gathering-1.jpg","family-gathering-2":"/__l5e/assets-v1/bef580e8-e9fa-4356-a421-c39096c767dd/push-occasion-family-gathering-2.jpg","family-gathering-3":"/__l5e/assets-v1/ecec90f1-c014-496f-8681-47362e6c155f/push-occasion-family-gathering-3.jpg","graduation-1":"/__l5e/assets-v1/0dfc966b-29bf-4240-bc18-6e0d78de5812/push-occasion-graduation-1.jpg","graduation-2":"/__l5e/assets-v1/a80028c6-d1f3-440e-820c-e333a4e410ee/push-occasion-graduation-2.jpg","graduation-3":"/__l5e/assets-v1/2c3f9869-e6dd-4113-a415-c0869d4e2631/push-occasion-graduation-3.jpg","kids-birthday-1":"/__l5e/assets-v1/73465575-b46a-42f3-ac97-8f28a579311a/push-occasion-kids-birthday-1.jpg","kids-birthday-2":"/__l5e/assets-v1/209ec7f6-2e29-4347-940c-7a993f967da1/push-occasion-kids-birthday-2.jpg","kids-birthday-3":"/__l5e/assets-v1/8704d705-b6d2-4adb-970b-544a2f7425d0/push-occasion-kids-birthday-3.jpg","newborn-1":"/__l5e/assets-v1/5b489b8c-3295-4496-87c3-36991589be82/push-occasion-newborn-1.jpg","newborn-2":"/__l5e/assets-v1/b307dc30-e595-43c8-aa0a-7d6bb5d57e91/push-occasion-newborn-2.jpg","newborn-3":"/__l5e/assets-v1/ccf5c7fe-c274-4a11-adb4-f0730b077d7c/push-occasion-newborn-3.jpg","promotion-1":"/__l5e/assets-v1/fb0d0d63-d2a9-4778-bd59-5044f5d49f82/push-occasion-promotion-1.jpg","promotion-2":"/__l5e/assets-v1/be3886c9-188d-4f20-8733-37880539b553/push-occasion-promotion-2.jpg","promotion-3":"/__l5e/assets-v1/b012a39c-28ca-4d6c-a5cc-26b159ffa1b2/push-occasion-promotion-3.jpg","ramadan-1":"/__l5e/assets-v1/00e0ddc7-b6df-4012-8906-04b242c59fce/push-occasion-ramadan-1.jpg","ramadan-2":"/__l5e/assets-v1/8434bff8-52cd-45eb-87f5-a88c37efcb6e/push-occasion-ramadan-2.jpg","ramadan-3":"/__l5e/assets-v1/3c03f26c-bba7-46a5-9a2e-231549983c5e/push-occasion-ramadan-3.jpg","recovery-1":"/__l5e/assets-v1/8ed3398c-f124-45c0-8cd3-30fe936d51b8/push-occasion-recovery-1.jpg","recovery-2":"/__l5e/assets-v1/a849ce34-7950-4186-82d1-1c698bd7f941/push-occasion-recovery-2.jpg","recovery-3":"/__l5e/assets-v1/273434f1-7acf-4155-9ccc-e5ff6704ab4a/push-occasion-recovery-3.jpg","wedding-1":"/__l5e/assets-v1/f6cb078f-a9a0-40db-9e79-b5dda309656a/push-occasion-wedding-1.jpg","wedding-2":"/__l5e/assets-v1/87964be6-03d3-4167-8022-90405344cd49/push-occasion-wedding-2.jpg","wedding-3":"/__l5e/assets-v1/1227b33a-19c3-4fe6-a669-cb31c70d3486/push-occasion-wedding-3.jpg"}'::jsonb ->> (
    CASE
      WHEN _type = 'condolence' THEN 'condolence-1'
      WHEN _type = 'birthday' AND _audience = 'child' THEN 'kids-birthday-' || n
      WHEN _type = 'gathering' THEN 'family-gathering-' || n
      WHEN _type = 'eid_fitr' THEN 'eid-fitr-' || n
      WHEN _type = 'eid_adha' THEN 'eid-adha-' || n
      ELSE coalesce(_type,'') || '-' || n
    END))
  FROM (SELECT greatest(1, least(3, coalesce(_design, 1)))::text AS n) d;
$f$;
REVOKE ALL ON FUNCTION public.occasion_push_image(text,int,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.push_content_for_url(_url text, _fallback text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_text text := _fallback; v_image text; v_parts text[];
  v_ev public.events; v_occ jsonb; v_label text;
BEGIN
  v_parts := regexp_match(COALESCE(_url,''), '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})');
  IF v_parts IS NULL THEN RETURN jsonb_build_object('body',v_text); END IF;
  v_id := v_parts[1]::uuid;
  IF _url LIKE '/family-occasions?focus=%' THEN
    SELECT * INTO v_ev FROM public.events WHERE id=v_id;
    BEGIN
      v_occ := CASE WHEN (v_ev.description::jsonb ->> '__familyOccasion') = 'true' THEN v_ev.description::jsonb -> 'occasion' END;
    EXCEPTION WHEN OTHERS THEN v_occ := NULL;
    END;
    IF v_occ IS NOT NULL THEN
      v_label := CASE v_occ->>'type'
        WHEN 'wedding' THEN '💍 زواج / ملكة' WHEN 'newborn' THEN '👶 مولود'
        WHEN 'graduation' THEN '🎓 تخرج' WHEN 'condolence' THEN '🤍 عزاء'
        WHEN 'birthday' THEN '🎂 يوم ميلاد' WHEN 'promotion' THEN '🏆 ترقية / إنجاز'
        WHEN 'recovery' THEN '🌿 الحمد لله على السلامة' WHEN 'gathering' THEN '👨‍👩‍👧 لمة عائلية'
        WHEN 'ramadan' THEN '🌙 رمضان مبارك' WHEN 'eid_fitr' THEN '✨ عيد فطر مبارك'
        WHEN 'eid_adha' THEN '🐑 عيد أضحى مبارك' ELSE NULL END;
      v_text := concat_ws(E'\n',
        concat_ws(' · ', v_label, nullif(btrim(coalesce(v_occ->>'title', v_ev.title)),'')),
        CASE WHEN nullif(v_occ->>'date','') IS NOT NULL OR nullif(v_occ->>'time','') IS NOT NULL
          THEN concat_ws('  ', '📅 ' || nullif(v_occ->>'date',''), '⏰ ' || nullif(v_occ->>'time','')) END,
        '📍 ' || nullif(coalesce(nullif(v_occ->>'location',''), v_ev.location),''));
      v_image := coalesce(nullif(v_ev.cover_image_url,''),
        public.occasion_push_image(v_occ->>'type', nullif(v_occ->>'design','')::int, v_occ->>'birthdayAudience'));
    ELSE
      v_text := concat_ws(E'\n', v_ev.title, nullif(v_ev.description,''), '📍 ' || nullif(v_ev.location,''));
      v_image := v_ev.cover_image_url;
    END IF;
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
  -- Storage paths (e.g. private trip images) are signed later by the sending function.
  IF v_image IS NOT NULL AND v_image !~* '^https://' THEN v_image := NULL; END IF;
  RETURN jsonb_strip_nulls(jsonb_build_object('body',coalesce(nullif(v_text,''),_fallback),'image',nullif(v_image,'')));
END; $function$;
REVOKE ALL ON FUNCTION public.push_content_for_url(text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_message_created()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_def text; v_endpoint text; v_key text;
  v_sender_name text; v_recipients uuid[]; v_preview text;
BEGIN
  SELECT COALESCE(full_name, arabic_name, 'رسالة جديدة') INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  SELECT array_agg(user_id) INTO v_recipients FROM public.conversation_participants
  WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id AND COALESCE(muted,false) = false;
  IF v_recipients IS NULL OR array_length(v_recipients,1) IS NULL THEN RETURN NEW; END IF;

  v_preview := CASE NEW.kind
    WHEN 'text' THEN COALESCE(NEW.body,'')
    WHEN 'image' THEN concat_ws(E'\n', '📷 صورة', nullif(btrim(coalesce(NEW.body,'')),''))
    WHEN 'audio' THEN '🎤 رسالة صوتية'
    ELSE concat_ws(E'\n', '📎 ملف', nullif(btrim(coalesce(NEW.body,'')),'')) END;

  v_def := pg_get_functiondef('public.call_send_push(text,text,text,uuid)'::regprocedure);
  v_key := (regexp_match(v_def, 'v_key text := ''([^'']+)'''))[1];
  v_endpoint := (regexp_match(v_def, 'v_endpoint text := ''([^'']+)'''))[1];
  IF v_key IS NULL OR v_endpoint IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := v_endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key,'apikey',v_key),
    body := jsonb_build_object(
      'title', COALESCE(v_sender_name,'رسالة جديدة'),
      'body', v_preview,
      'url', '/chat/'||NEW.conversation_id::text,
      'message_id', CASE WHEN NEW.kind = 'image' THEN NEW.id END,
      'user_ids', to_jsonb(v_recipients),
      'exclude_user_id', NEW.sender_id));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE LOG 'notify_message_created: %', SQLERRM; RETURN NEW;
END; $function$;