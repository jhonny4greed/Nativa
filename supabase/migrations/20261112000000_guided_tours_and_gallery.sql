-- Versioned, per-account onboarding. Existing accounts start with no completed tours.
create table public.player_tutorials (
  user_id uuid not null references auth.users(id) on delete cascade,
  tour_id text not null check (length(tour_id) between 1 and 80),
  version integer not null check (version > 0),
  status text not null check (status in ('completed', 'skipped')),
  updated_at timestamptz not null default now(),
  primary key (user_id, tour_id, version)
);
alter table public.player_tutorials enable row level security;
create policy "Own tutorial progress" on public.player_tutorials for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.player_tutorials to authenticated;

create table public.player_artworks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('nativa','biome','technique','other')),
  title text not null check (length(title) between 1 and 80),
  prompt text not null check (length(prompt) between 1 and 1400),
  photo_id text not null,
  storage_path text not null check (storage_path like user_id::text || '/%'),
  created_at timestamptz not null default now()
);
alter table public.player_artworks enable row level security;
create policy "Own artwork metadata" on public.player_artworks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.player_artworks to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('nativa-artworks','nativa-artworks',false,15000000,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "Read own artworks" on storage.objects for select to authenticated
  using (bucket_id='nativa-artworks' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Upload own artworks" on storage.objects for insert to authenticated
  with check (bucket_id='nativa-artworks' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Update own artworks" on storage.objects for update to authenticated
  using (bucket_id='nativa-artworks' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check (bucket_id='nativa-artworks' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Delete own artworks" on storage.objects for delete to authenticated
  using (bucket_id='nativa-artworks' and (storage.foldername(name))[1]=(select auth.uid())::text);
