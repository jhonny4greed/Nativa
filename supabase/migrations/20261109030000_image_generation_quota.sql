create table if not exists public.image_generation_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'UTC')::date,
  used integer not null default 0 check (used between 0 and 20),
  primary key(user_id,usage_date)
);
alter table public.image_generation_daily_usage enable row level security;
revoke all on public.image_generation_daily_usage from public,anon,authenticated;
grant all on public.image_generation_daily_usage to service_role;

create or replace function public.reserve_image_generation(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare reserved integer;
begin
  if p_user_id is null then return false; end if;
  insert into public.image_generation_daily_usage(user_id,usage_date,used)
  values(p_user_id,(now() at time zone 'UTC')::date,1)
  on conflict(user_id,usage_date) do update set used=public.image_generation_daily_usage.used+1
    where public.image_generation_daily_usage.used<20;
  get diagnostics reserved=row_count;
  return reserved=1;
end;
$$;
revoke all on function public.reserve_image_generation(uuid) from public,anon,authenticated;
grant execute on function public.reserve_image_generation(uuid) to service_role;
