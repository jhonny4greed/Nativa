-- Restore pre-progression attributes where the history records them. Campaign
-- copies in room_companions are intentionally untouched; their progress belongs
-- to that room.
create or replace function nativa_private.restore_initial_attributes(p_attrs jsonb, p_history jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_attrs jsonb := case when jsonb_typeof(p_attrs) = 'object' then p_attrs else '{}'::jsonb end;
  v_entry jsonb;
  v_attribute text;
begin
  if jsonb_typeof(p_history) <> 'array' then return v_attrs; end if;
  for v_entry in
    select entry.value from jsonb_array_elements(p_history) with ordinality as entry(value, position)
    order by entry.position desc
  loop
    v_attribute := v_entry->>'atributo';
    if v_entry->>'tipo' = 'atributo'
       and v_attribute = any(array['ATQ','POT','DEF','RES','AGI','HP','MP'])
       and jsonb_typeof(v_entry->'valorAnterior') = 'number' then
      v_attrs := jsonb_set(v_attrs, array[v_attribute], v_entry->'valorAnterior', true);
    end if;
  end loop;
  return v_attrs;
end
$function$;
revoke all on function nativa_private.restore_initial_attributes(jsonb,jsonb) from public, anon, authenticated;

with native_techniques as (
  select n.id,
         nativa_private.restore_initial_attributes(n.data->'attrs', n.data->'historicoProgressao') as initial_attrs,
         coalesce(jsonb_agg(t.value order by t.ordinality) filter (where t.origin_rank = 1), '[]'::jsonb) as starting_moves
  from public.nativas n
  left join lateral (
    select moves.value, moves.ordinality,
           row_number() over (partition by case
             when moves.value #>> '{}' like 'linhagem-%' then 'linhagem'
             when moves.value #>> '{}' like 'bioma-%' then 'bioma'
             when moves.value #>> '{}' like 'afinidade-%' then 'afinidade'
             when moves.value #>> '{}' like 'arquetipo-%' then 'arquetipo'
           end order by moves.ordinality) as origin_rank
    from jsonb_array_elements(case when jsonb_typeof(n.data->'techniques') = 'array' then n.data->'techniques' else '[]'::jsonb end)
      with ordinality as moves(value, ordinality)
    where jsonb_typeof(moves.value) = 'string'
      and (moves.value #>> '{}') like any(array['linhagem-%','bioma-%','afinidade-%','arquetipo-%'])
  ) t on true
  where n.deleted_at is null
  group by n.id
)
update public.nativas n
set data = n.data || jsonb_build_object(
  'progressResetVersion', 1,
  'ownerId', n.owner_id::text,
  'nivel', 1,
  'xp', 0,
  'xpTotal', 0,
  'xpa', 0,
  'estagio', 1,
  'attrs', nt.initial_attrs,
  'techniques', nt.starting_moves,
  'golpesIniciais', nt.starting_moves,
  'atributosIniciais', nt.initial_attrs,
  'essencias', '[]'::jsonb,
  'afinidadesEssencia', '[]'::jsonb,
  'essenciasDisponiveis', '[]'::jsonb,
  'historicoProgressao', '[]'::jsonb
), revision = n.revision + 1, updated_at = now()
from native_techniques nt
where nt.id = n.id;

-- User-selected portraits persist in a private, account-scoped bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nativa-portraits', 'nativa-portraits', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create policy "Nativa portrait owner read"
on storage.objects for select to authenticated
using (
  bucket_id = 'nativa-portraits'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1 from public.nativas n
      where n.owner_id::text = (storage.foldername(name))[1]
        and n.local_id = (storage.foldername(name))[2]
        and n.deleted_at is null
        and nativa_private.can_view_shared_nativa(n.id)
    )
    or exists (
      select 1 from public.room_companions c
      where c.player_id::text = (storage.foldername(name))[1]
        and c.source_local_id = (storage.foldername(name))[2]
        and c.is_active and nativa_private.is_room_member(c.room_id)
    )
  )
);

create policy "Nativa portrait owner upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'nativa-portraits' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Nativa portrait owner update"
on storage.objects for update to authenticated
using (bucket_id = 'nativa-portraits' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'nativa-portraits' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Nativa portrait owner delete"
on storage.objects for delete to authenticated
using (bucket_id = 'nativa-portraits' and (storage.foldername(name))[1] = (select auth.uid())::text);
