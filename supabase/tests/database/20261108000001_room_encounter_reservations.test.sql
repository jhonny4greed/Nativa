begin;
select no_plan();

select ok(to_regclass('public.room_encounters') is not null, 'encounter table exists');
select ok(to_regclass('public.room_encounter_participants') is not null, 'encounter participant table exists');
select ok((select relrowsecurity from pg_class where oid='public.room_encounters'::regclass), 'encounters have RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.room_encounter_participants'::regclass), 'encounter participants have RLS enabled');
select ok(to_regclass('public.room_encounter_one_active_per_companion_idx') is not null, 'partial unique reservation index exists');
select ok((select indexdef ilike '%where (released_at is null)%' from pg_indexes where schemaname='public' and indexname='room_encounter_one_active_per_companion_idx'), 'unique index covers only unreleased companion reservations');
select ok((select confdeltype='c' from pg_constraint where conname='room_encounter_participants_room_id_companion_id_player_id_fkey'), 'campaign companion deletion cascades its reservation history');
select ok(has_table_privilege('authenticated','public.room_encounters','SELECT'), 'authenticated members can read encounter rows subject to RLS');
select ok(not has_table_privilege('authenticated','public.room_encounters','INSERT'), 'clients cannot insert encounter rows directly');
select ok(not has_table_privilege('authenticated','public.room_encounters','UPDATE'), 'clients cannot update encounter rows directly');
select ok(not has_table_privilege('authenticated','public.room_encounter_participants','INSERT'), 'clients cannot insert participant rows directly');
select ok(not has_table_privilege('authenticated','public.room_encounter_participants','UPDATE'), 'clients cannot release reservations directly');
select ok(has_function_privilege('authenticated','public.start_room_encounter(uuid,uuid[])','EXECUTE'), 'authenticated users can call protected start RPC');
select ok(not has_function_privilege('anon','public.start_room_encounter(uuid,uuid[])','EXECUTE'), 'anonymous users cannot start encounters');
select ok(has_function_privilege('authenticated','public.finish_room_encounter(uuid,text)','EXECUTE'), 'authenticated users can call protected finish RPC');
select ok(not has_function_privilege('anon','public.finish_room_encounter(uuid,text)','EXECUTE'), 'anonymous users cannot finish encounters');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.start_room_encounter(uuid,uuid[])'::regprocedure), 'start RPC is SECURITY DEFINER with empty search_path');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.finish_room_encounter(uuid,text)'::regprocedure), 'finish RPC is SECURITY DEFINER with empty search_path');

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000801','authenticated','authenticated','enc-master@example.test','',now()),
 ('00000000-0000-4000-8000-000000000802','authenticated','authenticated','enc-player-a@example.test','',now()),
 ('00000000-0000-4000-8000-000000000803','authenticated','authenticated','enc-player-b@example.test','',now()),
 ('00000000-0000-4000-8000-000000000804','authenticated','authenticated','enc-outsider@example.test','',now());
insert into public.rooms (id,created_by,name) values
 ('10000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000801','Encontro A'),
 ('10000000-0000-4000-8000-000000000812','00000000-0000-4000-8000-000000000801','Encontro B');
insert into public.room_members (room_id,user_id,role) values
 ('10000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000801','master'),
 ('10000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000802','player'),
 ('10000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000803','player'),
 ('10000000-0000-4000-8000-000000000812','00000000-0000-4000-8000-000000000801','master'),
 ('10000000-0000-4000-8000-000000000812','00000000-0000-4000-8000-000000000802','player');
insert into public.nativas (id,owner_id,local_id,format_version,data) values
 ('20000000-0000-4000-8000-000000000821','00000000-0000-4000-8000-000000000802','enc-original-local',1,'{"id":"enc-original-local","name":"Fixture original"}');
insert into public.room_companions (id,room_id,player_id,source_nativa_id,source_local_id,format_version,campaign_data) values
 ('30000000-0000-4000-8000-000000000831','10000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000802','20000000-0000-4000-8000-000000000821','enc-original-local',1,'{"id":"enc-original-local","name":"Campanha A","nivel":1}'),
 ('30000000-0000-4000-8000-000000000832','10000000-0000-4000-8000-000000000812','00000000-0000-4000-8000-000000000802','20000000-0000-4000-8000-000000000821','enc-original-local',1,'{"id":"enc-original-local","name":"Campanha B","nivel":1}'),
 ('30000000-0000-4000-8000-000000000833','10000000-0000-4000-8000-000000000811','00000000-0000-4000-8000-000000000803',null,'enc-second-player',1,'{"id":"enc-second-player","name":"Outra Nativa","nivel":1}');

set local role authenticated;
select set_config('request.jwt.claims','{}',true);
select throws_ok($$select public.start_room_encounter('10000000-0000-4000-8000-000000000811',array['30000000-0000-4000-8000-000000000831']::uuid[])$$,'42501',null,'unauthenticated caller cannot start');
select throws_ok($$select public.finish_room_encounter('30000000-0000-4000-8000-000000000831','completed')$$,'42501',null,'unauthenticated caller cannot finish');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000802","role":"authenticated"}',true);
select is(public.start_room_encounter('10000000-0000-4000-8000-000000000811',array['30000000-0000-4000-8000-000000000831']::uuid[])->>'status','started','player starts an encounter with their own room instance');
select set_config('nativa_test.encounter_a',(select id::text from public.room_encounters where room_id='10000000-0000-4000-8000-000000000811' and created_by=auth.uid() and status='active'),true);
select is((select count(*) from public.room_encounter_participants where encounter_id=current_setting('nativa_test.encounter_a')::uuid and released_at is null),1::bigint,'started encounter has one active participant reservation');
select is(public.start_room_encounter('10000000-0000-4000-8000-000000000811',array['30000000-0000-4000-8000-000000000831']::uuid[])->>'status','companion_busy','same instance cannot start a second active encounter in same room');
select is(public.start_room_encounter('10000000-0000-4000-8000-000000000812',array['30000000-0000-4000-8000-000000000832']::uuid[])->>'status','started','same original Nativa starts in a different room instance');
select is((select count(*) from public.room_encounter_participants where companion_id in ('30000000-0000-4000-8000-000000000831','30000000-0000-4000-8000-000000000832') and released_at is null),2::bigint,'two room-specific instances of the same original can both be active');
select throws_ok($$select public.start_room_encounter('10000000-0000-4000-8000-000000000811',array['30000000-0000-4000-8000-000000000833']::uuid[])$$,'42501',null,'player cannot reserve another player companion');
select throws_ok($$select public.start_room_encounter('10000000-0000-4000-8000-000000000811',array['30000000-0000-4000-8000-000000000831','30000000-0000-4000-8000-000000000833']::uuid[])$$,'42501',null,'player cannot start a multi-player encounter before acceptance flow exists');
select ok((select count(*)=1 from public.room_encounters where id=current_setting('nativa_test.encounter_a')::uuid),'failed start does not create an encounter');
select is((select count(*) from public.room_encounters),2::bigint,'only successful starts created encounter rows');
select is((select count(*) from public.room_encounters where room_id='10000000-0000-4000-8000-000000000811'),1::bigint,'room A has its own active encounter');
select is((select count(*) from public.room_encounters where room_id='10000000-0000-4000-8000-000000000812'),1::bigint,'room B has its own active encounter');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000803","role":"authenticated"}',true);
select is(public.start_room_encounter('10000000-0000-4000-8000-000000000811',array['30000000-0000-4000-8000-000000000833']::uuid[])->>'status','started','different companion in same room can start independently');
select set_config('nativa_test.encounter_b',(select id::text from public.room_encounters where room_id='10000000-0000-4000-8000-000000000811' and created_by=auth.uid() and status='active'),true);
select is((select count(*) from public.room_encounters),'2'::bigint,'player sees room A encounters while room B remains private');
select throws_ok($$select public.finish_room_encounter(current_setting('nativa_test.encounter_b')::uuid,'cancelled')$$,'42501',null,'player cannot cancel an encounter as an administrator');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000802","role":"authenticated"}',true);
select throws_ok($$select public.finish_room_encounter(current_setting('nativa_test.encounter_b')::uuid,'completed')$$,'42501',null,'player cannot finish an encounter belonging only to another player');
select is(public.finish_room_encounter(current_setting('nativa_test.encounter_a')::uuid,'completed')->>'status','completed','participant can finish their encounter');
select ok((select finished_at is not null and finished_by=auth.uid() from public.room_encounters where id=current_setting('nativa_test.encounter_a')::uuid),'completion records actor and time');
select ok((select released_at is not null from public.room_encounter_participants where encounter_id=current_setting('nativa_test.encounter_a')::uuid),'completion releases the instance reservation');
select is(public.start_room_encounter('10000000-0000-4000-8000-000000000811',array['30000000-0000-4000-8000-000000000831']::uuid[])->>'status','started','released instance can start a later encounter');
select set_config('nativa_test.encounter_c',(select id::text from public.room_encounters where room_id='10000000-0000-4000-8000-000000000811' and created_by='00000000-0000-4000-8000-000000000802' and status='active'),true);

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000801","role":"authenticated"}',true);
select is(public.finish_room_encounter(current_setting('nativa_test.encounter_c')::uuid,'cancelled')->>'status','cancelled','master can cancel encounter');
select ok((select released_at is not null from public.room_encounter_participants where encounter_id=current_setting('nativa_test.encounter_c')::uuid),'master cancellation releases reservation');
select is(public.start_room_encounter('10000000-0000-4000-8000-000000000811',array['30000000-0000-4000-8000-000000000831']::uuid[])->>'status','started','instance is reusable after master cancellation');
select set_config('nativa_test.encounter_d',(select id::text from public.room_encounters where room_id='10000000-0000-4000-8000-000000000811' and created_by='00000000-0000-4000-8000-000000000801' and status='active'),true);
select is(public.finish_room_encounter(current_setting('nativa_test.encounter_d')::uuid,'completed')->>'status','completed','master can finish encounter administratively');
select throws_ok($$select public.finish_room_encounter(current_setting('nativa_test.encounter_d')::uuid,'forfeit')$$,'22023',null,'invalid finish mode is rejected');

select is((select count(*) from public.room_encounters where room_id='10000000-0000-4000-8000-000000000811' and status='active'),1::bigint,'unrelated players encounter remains active');
select is((select count(*) from public.room_encounter_participants where room_id='10000000-0000-4000-8000-000000000811' and released_at is null),1::bigint,'only the unrelated players reservation remains active');

reset role;
update public.rooms set status='closed' where id='10000000-0000-4000-8000-000000000812';
select is((select status from public.room_encounters where room_id='10000000-0000-4000-8000-000000000812'),'cancelled','closing a room administratively cancels active encounter reservations');
select is((select finish_reason from public.room_encounters where room_id='10000000-0000-4000-8000-000000000812'),'room_closed','room closure records its cancellation reason');
select ok((select released_at is not null from public.room_encounter_participants where room_id='10000000-0000-4000-8000-000000000812'),'room closure releases the companion reservation');

delete from public.rooms where id='10000000-0000-4000-8000-000000000812';
select is((select count(*) from public.room_encounters where room_id='10000000-0000-4000-8000-000000000812'),0::bigint,'room deletion cascades its encounter history');
select is((select count(*) from public.room_encounter_participants where room_id='10000000-0000-4000-8000-000000000812'),0::bigint,'room deletion cascades its companion reservations');
select is((select count(*) from public.nativas where id='20000000-0000-4000-8000-000000000821'),1::bigint,'room deletion preserves the original player Nativa');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000804","role":"authenticated"}',true);
select throws_ok($$select public.start_room_encounter('10000000-0000-4000-8000-000000000811',array['30000000-0000-4000-8000-000000000831']::uuid[])$$,'42501',null,'outsider cannot start encounter');
select throws_ok($$select public.finish_room_encounter(current_setting('nativa_test.encounter_b')::uuid,'completed')$$,'42501',null,'outsider cannot finish encounter');
select is((select count(*) from public.room_encounters where room_id='10000000-0000-4000-8000-000000000811'),0::bigint,'outsider cannot read encounter rows through RLS');
select is((select count(*) from public.room_encounter_participants where room_id='10000000-0000-4000-8000-000000000811'),0::bigint,'outsider cannot read participant rows through RLS');

reset role;
select * from finish();
rollback;
