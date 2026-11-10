-- Temporary private storage keeps generated artifacts available across Edge isolates.
-- The Edge Function accesses this bucket with the service role only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nativa-image-task-results',
  'nativa-image-task-results',
  false,
  15000000,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
