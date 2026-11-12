create table public.player_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  arena_effects boolean not null default true,
  arena_speed text not null default 'normal' check (arena_speed in ('fast','normal','slow')),
  updated_at timestamptz not null default now()
);
alter table public.player_preferences enable row level security;
create policy "Own presentation preferences" on public.player_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.player_preferences to authenticated;
