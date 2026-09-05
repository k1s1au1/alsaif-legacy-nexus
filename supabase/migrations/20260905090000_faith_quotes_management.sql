-- Managed faith reminders for the family dashboard.
-- Keep this feature isolated from app_settings so existing settings and policies are untouched.

create or replace function public.can_manage_faith_content(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _user_id is not null
    and (
      exists (
        select 1
        from public.section_heads sh
        where sh.user_id = _user_id
          and sh.section::text = 'faith'
      )
      or exists (
        select 1
        from public.user_roles ur
        where ur.user_id = _user_id
          and ur.role::text in ('chairman', 'vice_chairman')
      )
    );
$$;

revoke all on function public.can_manage_faith_content(uuid) from public;
grant execute on function public.can_manage_faith_content(uuid) to authenticated;

create table if not exists public.faith_quotes (
  id text primary key,
  text text not null check (char_length(trim(text)) > 0),
  source text not null check (char_length(trim(source)) > 0),
  quote_type text not null default 'quran' check (quote_type in ('quran', 'hadith', 'wisdom')),
  category text not null default 'general' check (category in ('general', 'friday', 'mon_thu', 'white_days')),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.faith_quotes enable row level security;

drop policy if exists "faith_quotes_read" on public.faith_quotes;
create policy "faith_quotes_read"
on public.faith_quotes
for select
to authenticated
using (true);

drop policy if exists "faith_quotes_insert" on public.faith_quotes;
create policy "faith_quotes_insert"
on public.faith_quotes
for insert
to authenticated
with check (public.can_manage_faith_content(auth.uid()));

drop policy if exists "faith_quotes_update" on public.faith_quotes;
create policy "faith_quotes_update"
on public.faith_quotes
for update
to authenticated
using (public.can_manage_faith_content(auth.uid()))
with check (public.can_manage_faith_content(auth.uid()));

drop policy if exists "faith_quotes_delete" on public.faith_quotes;
create policy "faith_quotes_delete"
on public.faith_quotes
for delete
to authenticated
using (public.can_manage_faith_content(auth.uid()));

create index if not exists faith_quotes_enabled_category_idx
  on public.faith_quotes (enabled, category, sort_order);

insert into public.faith_quotes (id, text, source, quote_type, category, enabled, sort_order)
values
  ('friday-quran', 'يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا نُودِيَ لِلصَّلَاةِ مِن يَوْمِ الْجُمُعَةِ فَاسْعَوْا إِلَىٰ ذِكْرِ اللَّهِ', 'سورة الجمعة', 'quran', 'friday', true, 10),
  ('friday-hadith', 'إِنَّ مِنْ أَفْضَلِ أَيَّامِكُمْ يَوْمَ الْجُمُعَةِ، فَأَكْثِرُوا عَلَيَّ مِنَ الصَّلَاةِ فِيهِ', 'حديث شريف (رواه أبو داود)', 'hadith', 'friday', true, 20),
  ('mon-thu', 'تُعْرَضُ الأَعْمَالُ يَوْمَ الاثْنَيْنِ وَالْخَمِيسِ، فَأُحِبُّ أَنْ يُعْرَضَ عَمَلِي وَأَنَا صَائِمٌ', 'حديث شريف (رواه الترمذي)', 'hadith', 'mon_thu', true, 30),
  ('white-days', 'صِيَامُ ثَلاثَةِ أَيَّامٍ مِنْ كُلِّ شَهْرٍ صِيَامُ الدَّهْرِ، وَهِيَ أَيَّامُ الْبِيضِ', 'حديث شريف (رواه النسائي)', 'hadith', 'white_days', true, 40),
  ('general-1', 'وَاعْتَصِمُوا بِحَبْلِ اللَّهِ جَمِيعًا وَلَا تَفَرَّقُوا', 'سورة آل عمران', 'quran', 'general', true, 50),
  ('general-2', 'وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ', 'سورة المائدة', 'quran', 'general', true, 60),
  ('general-3', 'إِنَّمَا الْمُؤْمِنُونَ إِخْوَةٌ', 'سورة الحجرات', 'quran', 'general', true, 70)
on conflict (id) do nothing;
