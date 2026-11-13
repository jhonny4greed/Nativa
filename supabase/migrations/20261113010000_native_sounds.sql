-- Persistent short vocalizations. No temporary provider URLs are stored.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nativa-sounds', 'nativa-sounds', false, 120000, array['audio/wav'])
on conflict (id) do update set public = false, file_size_limit = 120000, allowed_mime_types = array['audio/wav'];

-- The arena tables are deliberately not directly readable by authenticated users.
create function nativa_private.can_hear_native_sound(p_owner text, p_local_id text)
returns boolean language sql stable security definer set search_path = '' as $$
select auth.uid() is not null and (
  p_owner = auth.uid()::text
  or exists (select 1 from public.nativas n
    where n.owner_id::text = p_owner and n.local_id = p_local_id
      and n.deleted_at is null and nativa_private.can_view_shared_nativa(n.id))
  or exists (select 1 from public.room_companions c
    where c.player_id::text = p_owner and c.source_local_id = p_local_id
      and c.is_active and nativa_private.is_room_member(c.room_id))
  or exists (select 1 from public.arena_matches m
    where (m.host_id = auth.uid() or m.guest_id = auth.uid())
      and ((m.host_id::text = p_owner and m.host_ficha->>'id' = p_local_id)
        or (m.guest_id::text = p_owner and m.guest_ficha->>'id' = p_local_id)))
);
$$;
revoke all on function nativa_private.can_hear_native_sound(text,text) from public, anon, authenticated;
grant execute on function nativa_private.can_hear_native_sound(text,text) to authenticated;
create policy "Nativa sounds read" on storage.objects for select to authenticated
using (bucket_id = 'nativa-sounds' and nativa_private.can_hear_native_sound((storage.foldername(name))[1], (storage.foldername(name))[2]));
create policy "Nativa sounds upload" on storage.objects for insert to authenticated
with check (bucket_id = 'nativa-sounds' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Nativa sounds delete" on storage.objects for delete to authenticated
using (bucket_id = 'nativa-sounds' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter table public.player_preferences add column arena_sounds boolean not null default true;
