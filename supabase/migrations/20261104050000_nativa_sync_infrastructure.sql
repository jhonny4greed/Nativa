-- Secure server-side contract for future Nativa synchronization.
-- This migration does not enable client synchronization or change local storage.

alter table public.nativas
  add column revision bigint not null default 1 check (revision > 0),
  add column deleted_at timestamptz;

-- Existing records predate RPC validation. Backfill a missing embedded local
-- identifier, but refuse ambiguous or inconsistent identities instead of
-- silently changing an existing ficha identity.
do $migration$
begin
  begin
    execute 'alter table public.nativas disable trigger nativas_set_updated_at';

    if exists (
      select 1
      from public.nativas n
      where n.data ? 'id'
        and (
          jsonb_typeof(n.data->'id') is distinct from 'string'
          or n.data->>'id' is distinct from n.local_id
        )
    ) then
      raise exception 'Existing public.nativas rows contain invalid data.id/local_id identities';
    end if;

    update public.nativas n
    set data = jsonb_set(n.data, '{id}', to_jsonb(n.local_id), true)
    where not (n.data ? 'id');

    execute 'alter table public.nativas enable trigger nativas_set_updated_at';
  exception when others then
    -- The PL/pgSQL exception block is a subtransaction. On failure, the
    -- trigger-disable and any partial backfill are rolled back together.
    raise;
  end;
end
$migration$;

alter table public.nativas
  add constraint nativas_data_id_matches_local_id
  check (coalesce(
    data ? 'id'
    and jsonb_typeof(data->'id') = 'string'
    and data->>'id' = local_id,
    false
  ));

create table nativa_private.nativa_sync_operations (
  owner_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid not null,
  request_hash bytea not null check (octet_length(request_hash) = 32),
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (owner_id, operation_id),
  check (result is null or jsonb_typeof(result) = 'object')
);

alter table nativa_private.nativa_sync_operations enable row level security;
revoke all on table nativa_private.nativa_sync_operations from public, anon, authenticated;
revoke all on schema nativa_private from public, anon;
grant usage on schema nativa_private to authenticated;

-- Direct table writes cannot enforce revision checks, idempotency, or atomic
-- tombstoning. All authenticated writes now go through the RPCs below.
revoke insert, update, delete on table public.nativas from public, anon, authenticated;
revoke insert (owner_id, local_id, format_version, data) on table public.nativas from authenticated;
revoke update (data, format_version) on table public.nativas from authenticated;
drop policy if exists nativas_insert_owner on public.nativas;
drop policy if exists nativas_update_owner on public.nativas;
drop policy if exists nativas_delete_owner on public.nativas;

drop policy if exists nativas_select_owner_or_shared_master on public.nativas;
create policy nativas_select_owner_or_shared_master on public.nativas
for select to authenticated
using (
  deleted_at is null
  and (owner_id = (select auth.uid()) or nativa_private.can_view_shared_nativa(id))
);

drop policy if exists room_nativas_select_owner_or_master on public.room_nativas;
create policy room_nativas_select_owner_or_master on public.room_nativas
for select to authenticated
using (
  owner_id = (select auth.uid())
  or (
    nativa_private.is_room_master(room_id)
    and exists (
      select 1 from public.nativas n
      where n.id = room_nativas.nativa_id
        and n.deleted_at is null
    )
  )
);

drop policy if exists room_nativas_insert_owner_member on public.room_nativas;
create policy room_nativas_insert_owner_member on public.room_nativas
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and nativa_private.is_room_member(room_id)
  and exists (
    select 1 from public.nativas n
    where n.id = room_nativas.nativa_id
      and n.owner_id = (select auth.uid())
      and n.deleted_at is null
  )
);

create or replace function public.save_nativa(
  p_operation_id uuid,
  p_local_id text,
  p_format_version integer,
  p_data jsonb,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner_id uuid := auth.uid();
  v_request jsonb;
  v_request_hash bytea;
  v_inserted integer;
  v_result jsonb;
  v_remote_id uuid;
  v_revision bigint;
  v_format_version integer;
  v_data jsonb;
  v_deleted_at timestamptz;
begin
  if v_owner_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_operation_id is null
     or p_local_id is null
     or char_length(p_local_id) not between 1 and 160
     or p_format_version is null or p_format_version <= 0
     or p_data is null or jsonb_typeof(p_data) <> 'object'
     or jsonb_typeof(p_data->'id') is distinct from 'string'
     or p_data->>'id' is distinct from p_local_id
     or (p_expected_revision is not null and p_expected_revision <= 0) then
    raise exception 'invalid ficha synchronization request' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'operation', 'save',
    'local_id', p_local_id,
    'format_version', p_format_version,
    'data', p_data,
    'expected_revision', p_expected_revision
  );
  v_request_hash := extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256');

  insert into nativa_private.nativa_sync_operations (owner_id, operation_id, request_hash)
  values (v_owner_id, p_operation_id, v_request_hash)
  on conflict (owner_id, operation_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select op.request_hash, op.result
      into v_request_hash, v_result
    from nativa_private.nativa_sync_operations op
    where op.owner_id = v_owner_id and op.operation_id = p_operation_id
    for update;
    if v_request_hash <> extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256') then
      raise exception 'operation UUID was already used with different content' using errcode = '22023';
    end if;
    if v_result is null then
      raise exception 'operation result is incomplete' using errcode = '55000';
    end if;
    return v_result;
  end if;

  if p_expected_revision is null then
    insert into public.nativas (owner_id, local_id, format_version, data, revision)
    values (v_owner_id, p_local_id, p_format_version, p_data, 1)
    on conflict (owner_id, local_id) do nothing
    returning id, revision into v_remote_id, v_revision;

    if found then
      v_result := jsonb_build_object(
        'status', 'saved', 'remote_id', v_remote_id,
        'local_id', p_local_id, 'revision', v_revision
      );
    else
      select n.id, n.revision, n.format_version, n.data, n.deleted_at
        into v_remote_id, v_revision, v_format_version, v_data, v_deleted_at
      from public.nativas n
      where n.owner_id = v_owner_id and n.local_id = p_local_id
      for update;
      v_result := jsonb_build_object(
        'status', case when v_deleted_at is null then 'conflict' else 'deleted' end,
        'remote_id', v_remote_id, 'local_id', p_local_id,
        'revision', v_revision, 'format_version', v_format_version,
        'data', v_data, 'deleted_at', v_deleted_at
      );
    end if;
  else
    select n.id, n.revision, n.format_version, n.data, n.deleted_at
      into v_remote_id, v_revision, v_format_version, v_data, v_deleted_at
    from public.nativas n
    where n.owner_id = v_owner_id and n.local_id = p_local_id
    for update;

    if not found then
      v_result := jsonb_build_object('status', 'not_found', 'local_id', p_local_id);
    elsif v_deleted_at is not null then
      v_result := jsonb_build_object(
        'status', 'deleted', 'remote_id', v_remote_id, 'local_id', p_local_id,
        'revision', v_revision, 'deleted_at', v_deleted_at
      );
    elsif v_revision <> p_expected_revision then
      v_result := jsonb_build_object(
        'status', 'conflict', 'remote_id', v_remote_id, 'local_id', p_local_id,
        'revision', v_revision, 'format_version', v_format_version, 'data', v_data
      );
    else
      update public.nativas n
      set format_version = p_format_version,
          data = p_data,
          revision = n.revision + 1
      where n.id = v_remote_id
      returning n.revision into v_revision;
      v_result := jsonb_build_object(
        'status', 'saved', 'remote_id', v_remote_id,
        'local_id', p_local_id, 'revision', v_revision
      );
    end if;
  end if;

  update nativa_private.nativa_sync_operations op
  set result = v_result
  where op.owner_id = v_owner_id and op.operation_id = p_operation_id;
  return v_result;
end
$function$;

create or replace function public.delete_nativa(
  p_operation_id uuid,
  p_local_id text,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner_id uuid := auth.uid();
  v_request jsonb;
  v_request_hash bytea;
  v_inserted integer;
  v_result jsonb;
  v_remote_id uuid;
  v_revision bigint;
  v_format_version integer;
  v_data jsonb;
  v_deleted_at timestamptz;
begin
  if v_owner_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_operation_id is null
     or p_local_id is null
     or char_length(p_local_id) not between 1 and 160
     or p_expected_revision is null or p_expected_revision <= 0 then
    raise exception 'invalid ficha deletion request' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'operation', 'delete', 'local_id', p_local_id,
    'expected_revision', p_expected_revision
  );
  v_request_hash := extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256');

  insert into nativa_private.nativa_sync_operations (owner_id, operation_id, request_hash)
  values (v_owner_id, p_operation_id, v_request_hash)
  on conflict (owner_id, operation_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select op.request_hash, op.result
      into v_request_hash, v_result
    from nativa_private.nativa_sync_operations op
    where op.owner_id = v_owner_id and op.operation_id = p_operation_id
    for update;
    if v_request_hash <> extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256') then
      raise exception 'operation UUID was already used with different content' using errcode = '22023';
    end if;
    if v_result is null then
      raise exception 'operation result is incomplete' using errcode = '55000';
    end if;
    return v_result;
  end if;

  select n.id, n.revision, n.format_version, n.data, n.deleted_at
    into v_remote_id, v_revision, v_format_version, v_data, v_deleted_at
  from public.nativas n
  where n.owner_id = v_owner_id and n.local_id = p_local_id
  for update;

  if not found then
    v_result := jsonb_build_object('status', 'not_found', 'local_id', p_local_id);
  elsif v_revision <> p_expected_revision then
    v_result := jsonb_build_object(
      'status', 'conflict', 'remote_id', v_remote_id,
      'local_id', p_local_id, 'revision', v_revision,
      'format_version', v_format_version, 'data', v_data,
      'deleted_at', v_deleted_at
    );
  elsif v_deleted_at is not null then
    v_result := jsonb_build_object(
      'status', 'deleted', 'remote_id', v_remote_id,
      'local_id', p_local_id, 'revision', v_revision,
      'deleted_at', v_deleted_at
    );
  else
    update public.nativas n
    set deleted_at = clock_timestamp(), revision = n.revision + 1
    where n.id = v_remote_id
    returning n.revision, n.deleted_at into v_revision, v_deleted_at;

    delete from public.room_nativas rn
    where rn.nativa_id = v_remote_id and rn.owner_id = v_owner_id;

    v_result := jsonb_build_object(
      'status', 'deleted', 'remote_id', v_remote_id,
      'local_id', p_local_id, 'revision', v_revision,
      'deleted_at', v_deleted_at
    );
  end if;

  update nativa_private.nativa_sync_operations op
  set result = v_result
  where op.owner_id = v_owner_id and op.operation_id = p_operation_id;
  return v_result;
end
$function$;

revoke all on function public.save_nativa(uuid, text, integer, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.delete_nativa(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.save_nativa(uuid, text, integer, jsonb, bigint) to authenticated;
grant execute on function public.delete_nativa(uuid, text, bigint) to authenticated;
