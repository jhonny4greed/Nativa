-- A single admin-managed biological catalogue is shared by all accounts.
create table public.nativa_global_catalog (
  id text primary key check (id = 'main'),
  catalog jsonb not null default '{}'::jsonb check (jsonb_typeof(catalog) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.nativa_global_catalog (id, catalog)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.nativa_global_catalog enable row level security;
revoke all on public.nativa_global_catalog from public, anon, authenticated;
grant select on public.nativa_global_catalog to authenticated;

create policy nativa_global_catalog_read_authenticated
on public.nativa_global_catalog for select to authenticated
using (true);

create or replace function public.save_nativa_global_catalog(
  p_catalog jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_current_revision bigint;
  v_item jsonb;
  v_lineage text;
  v_ids jsonb;
  v_trait_ids text[] := array[]::text[];
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role = 'admin') then
    raise exception 'administrator role required' using errcode = '42501';
  end if;
  if p_catalog is null or jsonb_typeof(p_catalog) <> 'object'
     or jsonb_typeof(p_catalog->'tracos') <> 'array'
     or jsonb_typeof(p_catalog->'tracosQuimericos') <> 'array'
     or jsonb_typeof(p_catalog->'habitos') <> 'array'
     or jsonb_typeof(p_catalog->'tracosPorLinhagem') <> 'object'
     or octet_length(p_catalog::text) > 600000
     or jsonb_array_length(p_catalog->'tracos') > 500
     or jsonb_array_length(p_catalog->'tracosQuimericos') > 500
     or jsonb_array_length(p_catalog->'habitos') > 500 then
    raise exception 'invalid global catalogue shape or size' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_catalog->'tracos') loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item->>'id','') !~ '^[a-z0-9][a-z0-9-]{0,119}$'
       or char_length(coalesce(v_item->>'nome','')) not between 1 and 100
       or char_length(coalesce(v_item->>'categoria','')) not between 1 and 100
       or char_length(coalesce(v_item->>'descricao','')) not between 1 and 1000 then
      raise exception 'invalid trait entry' using errcode = '22023';
    end if;
    v_trait_ids := array_append(v_trait_ids, v_item->>'id');
  end loop;
  if cardinality(v_trait_ids) <> (select count(distinct item_id) from unnest(v_trait_ids) as ids(item_id)) then
    raise exception 'duplicate trait IDs' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_catalog->'tracosQuimericos') loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item->>'id','') !~ '^[a-z0-9][a-z0-9-]{0,119}$'
       or char_length(coalesce(v_item->>'nome','')) not between 1 and 100
       or char_length(coalesce(v_item->>'categoria','')) not between 1 and 100
       or char_length(coalesce(v_item->>'descricao','')) not between 1 and 1000 then
      raise exception 'invalid chimeric trait entry' using errcode = '22023';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p_catalog->'tracosQuimericos')) <>
     (select count(distinct value->>'id') from jsonb_array_elements(p_catalog->'tracosQuimericos')) then
    raise exception 'duplicate chimeric trait IDs' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_catalog->'habitos') loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item->>'id','') !~ '^[a-z0-9][a-z0-9-]{0,119}$'
       or char_length(coalesce(v_item->>'nome','')) not between 1 and 100
       or char_length(coalesce(v_item->>'categoria','')) not between 1 and 100
       or char_length(coalesce(v_item->>'descricao','')) > 1000 then
      raise exception 'invalid habit entry' using errcode = '22023';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p_catalog->'habitos')) <>
     (select count(distinct value->>'id') from jsonb_array_elements(p_catalog->'habitos')) then
    raise exception 'duplicate habit IDs' using errcode = '22023';
  end if;

  for v_lineage, v_ids in select key, value from jsonb_each(p_catalog->'tracosPorLinhagem') loop
    if char_length(v_lineage) not between 1 and 100 or jsonb_typeof(v_ids) <> 'array' or jsonb_array_length(v_ids) > 100 then
      raise exception 'invalid lineage defaults' using errcode = '22023';
    end if;
    for v_item in select value from jsonb_array_elements(v_ids) loop
      if jsonb_typeof(v_item) <> 'string' or not ((v_item #>> '{}') = any(v_trait_ids)) then
        raise exception 'lineage default references an unknown trait' using errcode = '22023';
      end if;
    end loop;
  end loop;

  select revision into v_current_revision
  from public.nativa_global_catalog where id = 'main' for update;
  if v_current_revision is distinct from p_expected_revision then
    raise exception 'catalogue changed; reload before saving' using errcode = '40001';
  end if;

  update public.nativa_global_catalog
  set catalog = p_catalog, revision = revision + 1, updated_at = now(), updated_by = v_user_id
  where id = 'main'
  returning jsonb_build_object('catalog', catalog, 'revision', revision, 'updated_at', updated_at)
  into v_result;
  return v_result;
end
$function$;

revoke all on function public.save_nativa_global_catalog(jsonb,bigint) from public, anon;
grant execute on function public.save_nativa_global_catalog(jsonb,bigint) to authenticated;

comment on table public.nativa_global_catalog is
  'Shared biological trait, chimeric-trait, habit, and lineage-default catalogue. Writes are admin-only through save_nativa_global_catalog.';
