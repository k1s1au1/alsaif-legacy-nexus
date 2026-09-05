-- Allow all authenticated family members to read the managed faith quotes,
-- while restricting writes to the faith section head and council leadership.

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

alter table public.app_settings enable row level security;

drop policy if exists "faith_quotes_read" on public.app_settings;
create policy "faith_quotes_read"
on public.app_settings
for select
to authenticated
using (key = 'faith_quotes');

drop policy if exists "faith_quotes_insert" on public.app_settings;
create policy "faith_quotes_insert"
on public.app_settings
for insert
to authenticated
with check (
  key = 'faith_quotes'
  and public.can_manage_faith_content(auth.uid())
);

drop policy if exists "faith_quotes_update" on public.app_settings;
create policy "faith_quotes_update"
on public.app_settings
for update
to authenticated
using (
  key = 'faith_quotes'
  and public.can_manage_faith_content(auth.uid())
)
with check (
  key = 'faith_quotes'
  and public.can_manage_faith_content(auth.uid())
);

drop policy if exists "faith_quotes_delete" on public.app_settings;
create policy "faith_quotes_delete"
on public.app_settings
for delete
to authenticated
using (
  key = 'faith_quotes'
  and public.can_manage_faith_content(auth.uid())
);
