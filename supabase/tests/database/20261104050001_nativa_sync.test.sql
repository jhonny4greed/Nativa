begin;
select plan(60);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', 'sync-master@example.test', '', now()),
  ('00000000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', 'sync-owner@example.test', '', now()),
  ('00000000-0000-4000-8000-000000000023', 'authenticated', 'authenticated', 'sync-outsider@example.test', '', now());

insert into public.rooms (id, created_by, name)
values ('10000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000021', 'Sala sync');
insert into public.room_members (room_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000021', 'master'),
  ('10000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000022', 'player');
insert into public.nativas (id, owner_id, local_id, format_version, data)
values
  ('20000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000022', 'local-sync-21', 4,
   '{"id":"local-sync-21","name":"Aruã","legacy_field":{"keep":true},"attrs":{"ATQ":2}}'),
  ('20000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000022', 'local-private-21', 1,
   '{"id":"local-private-21","name":"Privada"}'),
  ('20000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000021', 'master-local-21', 1,
   '{"id":"master-local-21","name":"Guarã"}');
insert into public.room_nativas (room_id, nativa_id, owner_id)
values ('10000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000022');

select throws_ok(
  $$insert into public.nativas (owner_id, local_id, format_version, data) values ('00000000-0000-4000-8000-000000000022', 'constraint-missing', 1, '{"name":"missing"}')$$,
  '23514', null, 'table constraint rejects missing data.id'
);
select throws_ok(
  $$insert into public.nativas (owner_id, local_id, format_version, data) values ('00000000-0000-4000-8000-000000000022', 'constraint-null', 1, '{"id":null}')$$,
  '23514', null, 'table constraint rejects null data.id'
);
select throws_ok(
  $$insert into public.nativas (owner_id, local_id, format_version, data) values ('00000000-0000-4000-8000-000000000022', 'constraint-number', 1, '{"id":123}')$$,
  '23514', null, 'table constraint rejects numeric data.id'
);
select throws_ok(
  $$insert into public.nativas (owner_id, local_id, format_version, data) values ('00000000-0000-4000-8000-000000000022', 'constraint-boolean', 1, '{"id":true}')$$,
  '23514', null, 'table constraint rejects boolean data.id'
);
select throws_ok(
  $$insert into public.nativas (owner_id, local_id, format_version, data) values ('00000000-0000-4000-8000-000000000022', 'constraint-object', 1, '{"id":{"value":"x"}}')$$,
  '23514', null, 'table constraint rejects object data.id'
);
select throws_ok(
  $$insert into public.nativas (owner_id, local_id, format_version, data) values ('00000000-0000-4000-8000-000000000022', 'constraint-array', 1, '{"id":["x"]}')$$,
  '23514', null, 'table constraint rejects array data.id'
);
select throws_ok(
  $$insert into public.nativas (owner_id, local_id, format_version, data) values ('00000000-0000-4000-8000-000000000022', 'constraint-mismatch', 1, '{"id":"other-local-id"}')$$,
  '23514', null, 'table constraint rejects a different string identity'
);

select ok(has_function_privilege('authenticated', 'public.save_nativa(uuid,text,integer,jsonb,bigint)', 'EXECUTE'), 'authenticated can execute save_nativa');
select ok(not has_function_privilege('anon', 'public.save_nativa(uuid,text,integer,jsonb,bigint)', 'EXECUTE'), 'anon cannot execute save_nativa');
select ok(has_function_privilege('authenticated', 'public.delete_nativa(uuid,text,bigint)', 'EXECUTE'), 'authenticated can execute delete_nativa');
select ok(not has_function_privilege('anon', 'public.delete_nativa(uuid,text,bigint)', 'EXECUTE'), 'anon cannot execute delete_nativa');
select ok(not has_table_privilege('authenticated', 'public.nativas', 'INSERT'), 'authenticated cannot insert nativas directly');
select ok(not has_table_privilege('authenticated', 'public.nativas', 'UPDATE'), 'authenticated cannot update nativas directly');
select ok(not has_table_privilege('authenticated', 'public.nativas', 'DELETE'), 'authenticated cannot delete nativas directly');
select ok(not has_table_privilege('authenticated', 'nativa_private.nativa_sync_operations', 'SELECT'), 'idempotency records are private');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000022","role":"authenticated"}', true);
select throws_ok(
  $$select public.save_nativa('30000000-0000-4000-8000-000000000021', 'local-sync-21', 4, '{"id":"forged-local-id"}', 1)$$,
  '22023', null, 'save rejects data.id that differs from local_id'
);
select throws_ok(
  $$select public.save_nativa('30000000-0000-4000-8000-000000000032', '123', 1, '{"id":123}', null)$$,
  '22023', null, 'save requires data.id to be a JSON string'
);
select throws_ok(
  $$select public.save_nativa('30000000-0000-4000-8000-000000000033', 'missing-id', 1, '{"name":"missing"}', null)$$,
  '22023', null, 'save rejects a missing data.id'
);
select throws_ok(
  $$select public.save_nativa('30000000-0000-4000-8000-000000000034', 'null-id', 1, '{"id":null}', null)$$,
  '22023', null, 'save rejects data.id null'
);
select throws_ok(
  $$select public.save_nativa('30000000-0000-4000-8000-000000000035', 'boolean-id', 1, '{"id":true}', null)$$,
  '22023', null, 'save rejects boolean data.id'
);
select throws_ok(
  $$select public.save_nativa('30000000-0000-4000-8000-000000000036', 'object-id', 1, '{"id":{"value":"object-id"}}', null)$$,
  '22023', null, 'save rejects object data.id'
);
select throws_ok(
  $$select public.save_nativa('30000000-0000-4000-8000-000000000037', 'array-id', 1, '{"id":["array-id"]}', null)$$,
  '22023', null, 'save rejects array data.id'
);
select is(
  public.save_nativa('30000000-0000-4000-8000-000000000031', 'local-created-21', 1,
    '{"id":"local-created-21","name":"Nova ficha","unknown":{"kept":true}}', null)->>'status',
  'saved', 'save creates a ficha when expected revision is null'
);
select is((select revision from public.nativas where owner_id = auth.uid() and local_id = 'local-created-21'), 1::bigint, 'new ficha starts at revision one');
select is((select data->>'id' = local_id from public.nativas where owner_id = auth.uid() and local_id = 'local-created-21'), true, 'new ficha stores local_id in data.id');
select is(
  public.save_nativa('30000000-0000-4000-8000-000000000031', 'local-created-21', 1,
    '{"id":"local-created-21","name":"Nova ficha","unknown":{"kept":true}}', null),
  public.save_nativa('30000000-0000-4000-8000-000000000031', 'local-created-21', 1,
    '{"id":"local-created-21","name":"Nova ficha","unknown":{"kept":true}}', null),
  'retrying creation with the same operation UUID returns the original result'
);
select is((select revision from public.nativas where owner_id = auth.uid() and local_id = 'local-created-21'), 1::bigint, 'idempotent creation retry does not increment revision');
select is((select count(*) from public.nativas where owner_id = auth.uid() and local_id = 'local-created-21'), 1::bigint, 'idempotent creation leaves exactly one remote ficha');
select throws_ok(
  $$select public.save_nativa('30000000-0000-4000-8000-000000000031', 'local-created-21', 1, '{"id":"local-created-21","name":"different content"}', null)$$,
  '22023', null, 'creation UUID cannot be reused with different content'
);
select is(
  public.save_nativa('30000000-0000-4000-8000-000000000021', 'local-sync-21', 4,
    '{"id":"local-sync-21","name":"Aruã v2","legacy_field":{"keep":true},"attrs":{"ATQ":3}}', 1)->>'status',
  'saved', 'owner updates their ficha with the expected revision'
);
select is((select revision from public.nativas where local_id = 'local-sync-21' and owner_id = auth.uid()), 2::bigint, 'successful update increments revision');
select is((select id::text from public.nativas where local_id = 'local-sync-21' and owner_id = auth.uid()), '20000000-0000-4000-8000-000000000021', 'remote UUID remains the database identity');
select is((select data->>'id' from public.nativas where local_id = 'local-sync-21' and owner_id = auth.uid()), 'local-sync-21', 'local ficha ID remains in data.id');
select is((select data->'legacy_field' from public.nativas where local_id = 'local-sync-21' and owner_id = auth.uid()), '{"keep":true}'::jsonb, 'unknown legacy fields survive synchronization');
select is(
  public.save_nativa('30000000-0000-4000-8000-000000000021', 'local-sync-21', 4,
    '{"id":"local-sync-21","name":"Aruã v2","legacy_field":{"keep":true},"attrs":{"ATQ":3}}', 1),
  public.save_nativa('30000000-0000-4000-8000-000000000021', 'local-sync-21', 4,
    '{"id":"local-sync-21","name":"Aruã v2","legacy_field":{"keep":true},"attrs":{"ATQ":3}}', 1),
  'retry with the same UUID and content returns the same result'
);
select is(
  public.save_nativa('30000000-0000-4000-8000-000000000022', 'local-sync-21', 4,
    '{"id":"local-sync-21","name":"Aruã v3"}', 1)->>'status',
  'conflict', 'stale revision is reported as conflict'
);
select is(
  public.save_nativa('30000000-0000-4000-8000-000000000022', 'local-sync-21', 4,
    '{"id":"local-sync-21","name":"Aruã v3"}', 1)->'data'->>'name',
  'Aruã v2', 'conflict response preserves the current remote version'
);
select throws_ok(
  $$select public.save_nativa('30000000-0000-4000-8000-000000000021', 'local-sync-21', 4, '{"id":"local-sync-21","name":"conteúdo diferente"}', 1)$$,
  '22023', null, 'reusing an operation UUID with different content is rejected'
);
select is(
  public.save_nativa('30000000-0000-4000-8000-000000000023', 'master-local-21', 1,
    '{"id":"master-local-21","name":"tentativa"}', 1)->>'status',
  'not_found', 'owner identity is derived from auth.uid and cannot target another owner ficha'
);
select is(public.delete_nativa('30000000-0000-4000-8000-000000000024', 'master-local-21', 1)->>'status', 'not_found', 'owner cannot delete another player ficha');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000021","role":"authenticated"}', true);
select is((select count(*) from public.nativas where local_id = 'local-sync-21'), 1::bigint, 'master can read explicitly shared active ficha');
select is((select count(*) from public.nativas where local_id = 'local-private-21'), 0::bigint, 'master cannot read a ficha that was not shared');
select throws_ok(
  $$update public.nativas set data = '{"id":"local-sync-21","name":"master edit"}' where local_id = 'local-sync-21'$$,
  '42501', null, 'master cannot directly edit a shared ficha'
);
select throws_ok(
  $$delete from public.nativas where local_id = 'local-sync-21'$$,
  '42501', null, 'master cannot directly delete another players ficha'
);
select is(
  public.save_nativa('30000000-0000-4000-8000-000000000025', 'local-sync-21', 4,
    '{"id":"local-sync-21","name":"master rpc edit"}', 2)->>'status',
  'not_found', 'master RPC cannot edit a players ficha'
);
select is(
  public.delete_nativa('30000000-0000-4000-8000-000000000035', 'local-sync-21', 2)->>'status',
  'not_found', 'master RPC cannot delete a players ficha'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000023","role":"authenticated"}', true);
select is((select count(*) from public.nativas where local_id = 'local-sync-21'), 0::bigint, 'unrelated player cannot read an unshared ficha');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000022","role":"authenticated"}', true);
select is(public.delete_nativa('30000000-0000-4000-8000-000000000026', 'local-sync-21', 2)->>'status', 'deleted', 'owner deletes ficha using the current revision');
reset role;
select is((select revision from public.nativas where local_id = 'local-sync-21' and owner_id = '00000000-0000-4000-8000-000000000022'), 3::bigint, 'delete increments revision');
select is((select count(*) from public.room_nativas where nativa_id = '20000000-0000-4000-8000-000000000021'), 0::bigint, 'delete removes room shares in the same transaction');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000022","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.room_nativas (room_id, nativa_id, owner_id) values ('10000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000021', auth.uid())$$,
  '42501', null, 'owner cannot create a new share for a tombstoned ficha'
);
select is(
  public.delete_nativa('30000000-0000-4000-8000-000000000026', 'local-sync-21', 2)->>'status',
  'deleted', 'retry of delete returns its recorded result'
);
select is(
  public.save_nativa('30000000-0000-4000-8000-000000000027', 'local-sync-21', 4,
    '{"id":"local-sync-21","name":"late resurrection"}', 3)->>'status',
  'deleted', 'late save cannot resurrect a tombstoned ficha'
);
reset role;
select is((select deleted_at is not null from public.nativas where local_id = 'local-sync-21' and owner_id = '00000000-0000-4000-8000-000000000022'), true, 'tombstone is retained on the ficha');
select is((select revision from public.nativas where local_id = 'local-sync-21' and owner_id = '00000000-0000-4000-8000-000000000022'), 3::bigint, 'attempted save leaves tombstone revision unchanged');
select is((select data->>'name' from public.nativas where local_id = 'local-sync-21' and owner_id = '00000000-0000-4000-8000-000000000022'), 'Aruã v2', 'attempted save leaves tombstoned data unchanged');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000022","role":"authenticated"}', true);
select is((select count(*) from public.nativas where local_id = 'local-sync-21' and owner_id = auth.uid()), 0::bigint, 'tombstoned ficha is no longer readable through the public table');
select is(
  public.delete_nativa('30000000-0000-4000-8000-000000000028', 'local-sync-21', 2)->>'status',
  'conflict', 'delete using a stale revision cannot change the tombstone'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select public.save_nativa('30000000-0000-4000-8000-000000000029', 'anonymous-local', 1, '{"id":"anonymous-local"}', null)$$,
  '42501', null, 'unauthenticated user cannot save a ficha'
);
select throws_ok(
  $$select public.delete_nativa('30000000-0000-4000-8000-000000000030', 'local-sync-21', 3)$$,
  '42501', null, 'unauthenticated user cannot delete a ficha'
);

select * from finish();
rollback;
