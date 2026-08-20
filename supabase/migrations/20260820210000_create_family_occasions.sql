create table if not exists public.family_occasions (
  id uuid primary key,
  type text not null,
  design integer not null default 1,
  title text not null default '',
  event_date date,
  event_time text,
  location text not null default '',
  details jsonb not null default '{}'::jsonb,
  birth_date date,
  birthday_audience text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.family_occasions enable row level security;

drop policy if exists "Authenticated users can read family occasions" on public.family_occasions;
create policy "Authenticated users can read family occasions"
on public.family_occasions for select
to authenticated
using (true);

drop policy if exists "Authenticated users can create family occasions" on public.family_occasions;
create policy "Authenticated users can create family occasions"
on public.family_occasions for insert
to authenticated
with check (auth.uid() = created_by or created_by is null);

drop policy if exists "Authenticated users can update family occasions" on public.family_occasions;
create policy "Authenticated users can update family occasions"
on public.family_occasions for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete family occasions" on public.family_occasions;
create policy "Authenticated users can delete family occasions"
on public.family_occasions for delete
to authenticated
using (true);

create index if not exists family_occasions_event_date_idx on public.family_occasions(event_date);
create index if not exists family_occasions_created_at_idx on public.family_occasions(created_at desc);

create or replace function public.set_family_occasions_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_family_occasions_updated_at on public.family_occasions;
create trigger trg_family_occasions_updated_at
before update on public.family_occasions
for each row execute function public.set_family_occasions_updated_at();
