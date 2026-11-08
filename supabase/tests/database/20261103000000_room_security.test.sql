begin;
select plan(50);

-- Fixtures are rolled back at the end of this pgTAP test.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'nativa-master@example.test', '', now()),
  ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'nativa-player@example.test', '', now()),
  ('00000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'nativa-guest@example.test', '', now()),
  ('00000000-0000-4000-8000-00000000000d', 'authenticated', 'authenticated', 'nativa-unrelated@example.test', '', now());

insert into public.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-00000000000a', 'Mestre'),
  ('00000000-0000-4000-8000-00000000000b', 'Jogador'),
  ('00000000-0000-4000-8000-00000000000c', 'Convidado'),
  ('00000000-0000-4000-8000-00000000000d', 'Externo');

insert into public.rooms (id, created_by, name)
values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'Sala de teste');
insert into public.room_members (room_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'master'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000b', 'player');
insert into public.room_state (room_id, revision, state, updated_by)
values ('10000000-0000-4000-8000-000000000001', 0, '{"turn":1}', '00000000-0000-4000-8000-00000000000a');
insert into public.room_events (room_id, revision, actor_id, event_type)
values ('10000000-0000-4000-8000-000000000001', 0, '00000000-0000-4000-8000-00000000000a', 'room_created');

insert into public.nativas (id, owner_id, local_id, format_version, data)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000b', 'legacy-nativa-42', 1,
   '{"id":"legacy-nativa-42","name":"Aruã","attrs":{"ATQ":2},"techniques":["tech-1"],"photoId":"photo-1"}'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 'master-local-7', 3,
   '{"id":"master-local-7","name":"Guarã","essencias":[]}'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000c', 'guest-local-1', 1,
   '{"id":"guest-local-1","name":"Convidado","techniques":[]}');
insert into public.room_nativas (room_id, nativa_id, owner_id)
values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000b');

insert into public.room_invites (room_id, kind, token_hash, created_by, expires_at, max_uses)
values
  ('10000000-0000-4000-8000-000000000001', 'link',
   extensions.digest(convert_to('TestInviteToken_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789', 'UTF8'), 'sha256'),
   '00000000-0000-4000-8000-00000000000a', now() + interval '1 day', 1),
  ('10000000-0000-4000-8000-000000000001', 'code',
   extensions.digest(convert_to('ExpiredInviteToken_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789', 'UTF8'), 'sha256'),
   '00000000-0000-4000-8000-00000000000a', now() - interval '1 day', 1);

select ok(has_table_privilege('authenticated', 'public.nativas', 'SELECT'), 'authenticated can read rows permitted by RLS');
select ok(not has_table_privilege('authenticated', 'public.nativas', 'INSERT') and not has_table_privilege('authenticated', 'public.nativas', 'UPDATE') and not has_table_privilege('authenticated', 'public.nativas', 'DELETE'), 'authenticated writes fichas only through validated RPCs');
select ok(not has_column_privilege('authenticated', 'public.nativas', 'owner_id', 'UPDATE'), 'owner_id cannot be reassigned by clients');
select ok(not has_table_privilege('anon', 'public.nativas', 'SELECT'), 'unauthenticated role has no ficha table grant');
select ok(not has_table_privilege('authenticated', 'public.room_invites', 'SELECT'), 'invite hashes are not directly readable');
select ok(has_function_privilege('authenticated', 'nativa_private.is_room_member(uuid)', 'EXECUTE'), 'authenticated role can execute the internal RLS predicate');
select ok(not has_function_privilege('anon', 'nativa_private.is_room_member(uuid)', 'EXECUTE'), 'anon role cannot execute internal RLS predicates');
select ok(not has_function_privilege('anon', 'public.create_room(text,jsonb)', 'EXECUTE'), 'anon role cannot execute protected room operations');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

select is(
  (select count(*) from public.nativas where id = '20000000-0000-4000-8000-000000000001'),
  1::bigint,
  'master can view a ficha explicitly shared into the room'
);
select throws_ok(
  $$update public.nativas set data = '{"id":"legacy-nativa-42","name":"alterada pelo mestre"}' where id = '20000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'master cannot edit another player ficha directly'
);
select throws_ok(
  $$delete from public.nativas where id = '20000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'master cannot delete another player ficha directly'
);
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-00000000000b'),
  1::bigint,
  'master can view the profile of a room member'
);
select is(
  public.update_room_state('10000000-0000-4000-8000-000000000001', 0, '{"turn":2}', 'turn_updated', '{"turn":2}'),
  1::bigint,
  'master commits a room snapshot with the expected revision'
);
select throws_ok(
  $$select public.update_room_state('10000000-0000-4000-8000-000000000001', 0, '{"turn":99}', 'stale', '{}')$$,
  '40001', 'room state revision conflict', 'stale concurrent room update is rejected'
);
select is(
  (select revision from public.room_state where room_id = '10000000-0000-4000-8000-000000000001'),
  1::bigint,
  'rejected stale update leaves the committed state revision intact'
);
select is(
  (select count(*) from public.room_events where room_id = '10000000-0000-4000-8000-000000000001' and revision = 1),
  1::bigint,
  'snapshot and event are committed atomically'
);
select ok(char_length(public.create_room_invite('10000000-0000-4000-8000-000000000001', 'code', now() + interval '1 day', 1)) >= 20,
  'master can generate a high-entropy room code');
select ok(char_length(public.create_room_invite('10000000-0000-4000-8000-000000000001', 'link', now() + interval '1 day', 3)) >= 40,
  'master can generate a high-entropy invite link token');
select throws_ok(
  $$select public.create_room_invite('10000000-0000-4000-8000-000000000001', 'invalid', now() + interval '1 day', 1)$$,
  '22023', 'invalid invite kind', 'invite type is validated in the database'
);
select lives_ok(
  $$select public.create_room('Sala criada atomicamente', '{"seed":"snapshot"}'::jsonb)$$,
  'create_room completes as one database operation'
);
select is(
  (select count(*) from public.room_members rm join public.rooms r on r.id = rm.room_id
   where r.name = 'Sala criada atomicamente' and rm.user_id = auth.uid() and rm.role = 'master'),
  1::bigint,
  'room creator is atomically registered as master'
);
select is(
  (select count(*) from public.room_state rs join public.rooms r on r.id = rs.room_id
   where r.name = 'Sala criada atomicamente' and rs.revision = 0
     and rs.state = '{"seed":"snapshot"}'::jsonb),
  1::bigint,
  'new room starts with the requested recoverable state snapshot'
);
select is(
  (select count(*) from public.room_events ev join public.rooms r on r.id = ev.room_id
   where r.name = 'Sala criada atomicamente' and ev.revision = 0
     and ev.event_type = 'room_created' and ev.actor_id = auth.uid()),
  1::bigint,
  'new room creation records its initial event atomically'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

select is((select count(*) from public.nativas where id = '20000000-0000-4000-8000-000000000001'), 1::bigint, 'player can read their own ficha');
select is((select count(*) from public.nativas where id = '20000000-0000-4000-8000-000000000002'), 0::bigint, 'player cannot read an unshared ficha owned by another user');
select lives_ok(
  $test$do $block$
  declare v_result jsonb; v_name text;
  begin
    v_result := public.save_nativa(
      '30000000-0000-4000-8000-000000000001', 'legacy-nativa-42', 1,
      '{"id":"legacy-nativa-42","name":"Aruã Atualizada","attrs":{"ATQ":2},"techniques":["tech-1"],"photoId":"photo-1"}', 1
    );
    select data->>'name' into v_name from public.nativas
    where id = '20000000-0000-4000-8000-000000000001';
    if v_result->>'status' <> 'saved' or (v_result->>'revision')::bigint <> 2 or v_name <> 'Aruã Atualizada' then
      raise exception 'player could not update their own ficha';
    end if;
  end;
  $block$;$test$,
  'player can update their own ficha'
);
select is((select local_id from public.nativas where id = '20000000-0000-4000-8000-000000000001'), 'legacy-nativa-42', 'local ficha identifier is preserved');
select is((select format_version from public.nativas where id = '20000000-0000-4000-8000-000000000001'), 1, 'legacy ficha format version is preserved');
select throws_ok(
  $$update public.nativas set data = '{"id":"master-local-7","name":"alterada pelo jogador"}' where id = '20000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'player cannot edit another user ficha directly'
);
select throws_ok(
  $$update public.room_state set state = '{"turn":77}' where room_id = '10000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'player cannot write canonical room state directly'
);
select throws_ok(
  $$update public.nativas set owner_id = auth.uid() where id = '20000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'player cannot reassign ficha ownership'
);
select is(
  (select data->>'name' from public.nativas where id = '20000000-0000-4000-8000-000000000001'),
  'Aruã Atualizada',
  'player can edit their own ficha and retain access'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);

select is((select count(*) from public.rooms), 0::bigint, 'authenticated non-member cannot view the room');
select is((select count(*) from public.nativas where id = '20000000-0000-4000-8000-000000000001'), 0::bigint, 'authenticated non-member cannot view a shared ficha');
select throws_ok(
  $$update public.nativas set data = '{"id":"legacy-nativa-42","name":"alterada por externo"}' where id = '20000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'authenticated non-member cannot modify another user ficha directly'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select throws_ok(
  $$select public.join_room_with_invite('ExpiredInviteToken_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789')$$,
  'P0001', 'invalid or unavailable invite', 'expired invite cannot be redeemed'
);
select is(
  public.join_room_with_invite('TestInviteToken_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789'),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'valid invite joins the room through the database function'
);
reset role;
select is(
  (select role from public.room_members where room_id = '10000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-00000000000c'),
  'player',
  'invite join always assigns player role'
);
select is(
  (select uses_count from public.room_invites where token_hash = extensions.digest(convert_to('TestInviteToken_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789', 'UTF8'), 'sha256')),
  1,
  'successful invite redemption increments uses exactly once'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select is(
  public.join_room_with_invite('TestInviteToken_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789'),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'retry by an existing member is idempotent after token use'
);
reset role;
select is(
  (select uses_count from public.room_invites where token_hash = extensions.digest(convert_to('TestInviteToken_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789', 'UTF8'), 'sha256')),
  1,
  'idempotent retry does not consume another invite use'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select is((select count(*) from public.nativas where id = '20000000-0000-4000-8000-000000000003'), 1::bigint, 'joined player can read own ficha');
select is((select count(*) from public.nativas where id = '20000000-0000-4000-8000-000000000001'), 0::bigint, 'player still cannot read another player ficha');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
select is((select count(*) from public.rooms), 0::bigint, 'unrelated authenticated user cannot enumerate rooms');
select throws_ok(
  $$select public.join_room_with_invite('TestInviteToken_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789')$$,
  'P0001', 'invalid or unavailable invite', 'invite usage limit blocks another user'
);
select throws_ok(
  $$select public.create_room_invite('10000000-0000-4000-8000-000000000001', 'link', now() + interval '1 day', 1)$$,
  '42501', 'room master required', 'non-member cannot create an invite'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select count(*) from public.rooms$$,
  '42501', null, 'unauthenticated user has no privilege to query rooms'
);
select throws_ok(
  $$select count(*) from public.nativas$$,
  '42501', null, 'unauthenticated user has no privilege to query fichas'
);
select throws_ok(
  $$select public.create_room('Sem login')$$,
  '42501', null, 'unauthenticated user cannot create a room'
);
select throws_ok(
  $$update public.nativas set data = '{}' where id = '20000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'unauthenticated user cannot modify another user ficha'
);

select * from finish();
rollback;
