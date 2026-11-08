begin;
select plan(4);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'fallback-master@example.test', '', now()),
  ('00000000-0000-4000-8000-0000000000c2', 'authenticated', 'authenticated', 'fallback-player@example.test', '', now());
insert into public.profiles (id, display_name)
values ('00000000-0000-4000-8000-0000000000c1', 'Mestre com perfil');
insert into public.rooms (id, created_by, name)
values ('10000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000c1', 'Sala sem perfil completo');
insert into public.room_members (room_id, user_id, role)
values
  ('10000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000c1', 'master'),
  ('10000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000c2', 'player');

select ok(has_function_privilege('authenticated', 'public.get_room_participants(uuid)', 'EXECUTE'), 'authenticated can use the participant RPC');
select ok(not has_function_privilege('anon', 'public.get_room_participants(uuid)', 'EXECUTE'), 'anon cannot use the participant RPC');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
select is((select count(*) from public.get_room_participants('10000000-0000-4000-8000-0000000000c3')), 2::bigint, 'member without a profile is not hidden from the room roster');
select is((select count(*) from public.get_room_participants('10000000-0000-4000-8000-0000000000c3') where display_name = 'Jogador' and role = 'player'), 1::bigint, 'missing profile gets a safe fallback display name');

select * from finish();
rollback;
