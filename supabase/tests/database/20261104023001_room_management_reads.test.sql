begin;
select plan(13);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'room-master@example.test', '', now()),
  ('00000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'room-player@example.test', '', now()),
  ('00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'room-outsider@example.test', '', now());

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-0000000000a1', 'Mestre Teste'),
  ('00000000-0000-4000-8000-0000000000a2', 'Jogadora Teste'),
  ('00000000-0000-4000-8000-0000000000a3', 'Externo Teste');

insert into public.rooms (id, created_by, name)
values ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'Sala protegida');
insert into public.room_members (room_id, user_id, role)
values
  ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 'master'),
  ('10000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2', 'player');
insert into public.room_invites (room_id, kind, token_hash, created_by, expires_at, max_uses)
values (
  '10000000-0000-4000-8000-0000000000a1', 'code',
  extensions.digest(convert_to('RoomManagementTestInvite_0123456789', 'UTF8'), 'sha256'),
  '00000000-0000-4000-8000-0000000000a1', now() + interval '1 day', 3
);

select ok(has_function_privilege('authenticated', 'public.get_room_participants(uuid)', 'EXECUTE'), 'authenticated users can call the participant RPC');
select ok(not has_function_privilege('anon', 'public.get_room_participants(uuid)', 'EXECUTE'), 'anonymous users cannot call the participant RPC');
select ok(has_function_privilege('authenticated', 'public.list_room_invites(uuid)', 'EXECUTE'), 'authenticated users can call the invite metadata RPC');
select ok(not has_function_privilege('anon', 'public.list_room_invites(uuid)', 'EXECUTE'), 'anonymous users cannot call the invite metadata RPC');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select is((select count(*) from public.get_room_participants('10000000-0000-4000-8000-0000000000a1')), 2::bigint, 'master sees all room participants');
select is((select count(*) from public.get_room_participants('10000000-0000-4000-8000-0000000000a1') where display_name = 'Jogadora Teste' and role = 'player'), 1::bigint, 'participant RPC returns player display name and role');
select is((select count(*) from public.list_room_invites('10000000-0000-4000-8000-0000000000a1') where kind = 'code' and max_uses = 3 and uses_count = 0 and revoked_at is null), 1::bigint, 'master sees invite management metadata');
select ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'room_invites' and column_name = 'token'), 'room_invites has no raw token column');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
select is((select count(*) from public.get_room_participants('10000000-0000-4000-8000-0000000000a1')), 2::bigint, 'player sees room participants through the scoped RPC');
select throws_ok(
  $$select count(*) from public.list_room_invites('10000000-0000-4000-8000-0000000000a1')$$,
  '42501', 'room master required', 'player cannot list room invites'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
select throws_ok(
  $$select count(*) from public.get_room_participants('10000000-0000-4000-8000-0000000000a1')$$,
  '42501', 'room member required', 'non-member cannot list room participants'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select count(*) from public.get_room_participants('10000000-0000-4000-8000-0000000000a1')$$,
  '42501', null, 'anonymous user cannot read participants'
);
select throws_ok(
  $$select count(*) from public.list_room_invites('10000000-0000-4000-8000-0000000000a1')$$,
  '42501', null, 'anonymous user cannot read invite metadata'
);

select * from finish();
rollback;
