begin;
select plan(5);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'invite-master@example.test', '', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'invite-player@example.test', '', now()),
  ('00000000-0000-4000-8000-0000000000b3', 'authenticated', 'authenticated', 'invite-outsider@example.test', '', now());

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-0000000000b1', 'Mestre Convites'),
  ('00000000-0000-4000-8000-0000000000b2', 'Jogadora Convites'),
  ('00000000-0000-4000-8000-0000000000b3', 'Externo Convites');

insert into public.rooms (id, created_by, name)
values
  ('10000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b1', 'Sala de convites'),
  ('10000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b3', 'Outra sala');
insert into public.room_members (room_id, user_id, role)
values
  ('10000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b1', 'master'),
  ('10000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b2', 'player'),
  ('10000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b3', 'master');
insert into public.room_invites (id, room_id, kind, token_hash, created_by, expires_at, max_uses, revoked_at)
values (
  '20000000-0000-4000-8000-0000000000b1',
  '10000000-0000-4000-8000-0000000000b1', 'code',
  extensions.digest(convert_to('RevokedInviteToken_0123456789_ABCDEF', 'UTF8'), 'sha256'),
  '00000000-0000-4000-8000-0000000000b1', now() + interval '1 day', 5, now()
), (
  '20000000-0000-4000-8000-0000000000b2',
  '10000000-0000-4000-8000-0000000000b2', 'code',
  extensions.digest(convert_to('AnotherRoomInviteToken_0123456789', 'UTF8'), 'sha256'),
  '00000000-0000-4000-8000-0000000000b3', now() + interval '1 day', 5, null
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_room_invite('10000000-0000-4000-8000-0000000000b1', 'code', now() + interval '1 day', 1)$$,
  '42501', 'room master required', 'player cannot generate a room invite'
);
select throws_ok(
  $$select public.revoke_room_invite('10000000-0000-4000-8000-0000000000b2', '20000000-0000-4000-8000-0000000000b2')$$,
  '42501', 'room master required', 'player cannot revoke an invite from another room'
);
select throws_ok(
  $$select public.join_room_with_invite('DefinitelyInvalidInviteToken_0123456789')$$,
  'P0001', 'invalid or unavailable invite', 'arbitrary invite token is rejected'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b3","role":"authenticated"}', true);
select throws_ok(
  $$select public.join_room_with_invite('RevokedInviteToken_0123456789_ABCDEF')$$,
  'P0001', 'invalid or unavailable invite', 'revoked invite cannot add a new participant'
);
reset role;
select is(
  (select count(*) from public.room_members where room_id = '10000000-0000-4000-8000-0000000000b1'),
  2::bigint,
  'failed invite attempts leave room membership unchanged'
);

select * from finish();
rollback;
