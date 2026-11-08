begin;
select plan(73);

select ok(to_regclass('public.room_companions') is not null, 'room_companions table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.room_companions'::regclass), 'room_companions has RLS enabled');
select ok(to_regclass('public.room_companions_one_active_per_player_room_idx') is not null, 'one-active-companion partial unique index exists');
select ok(has_table_privilege('authenticated', 'public.room_companions', 'SELECT'), 'authenticated can query authorized companion rows');
select ok(not has_table_privilege('authenticated', 'public.room_companions', 'INSERT'), 'clients cannot insert companions directly');
select ok(not has_table_privilege('authenticated', 'public.room_companions', 'UPDATE'), 'clients cannot update companions directly');
select ok(not has_table_privilege('authenticated', 'public.room_companions', 'DELETE'), 'clients cannot delete companions directly');
select ok(has_function_privilege('authenticated', 'public.get_room_companions(uuid)', 'EXECUTE'), 'authenticated can execute protected companion read RPC');
select ok(not has_function_privilege('anon', 'public.get_room_companions(uuid)', 'EXECUTE'), 'anonymous cannot execute companion read RPC');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.get_room_companions(uuid)'::regprocedure), 'companion read RPC is SECURITY DEFINER with empty search_path');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.choose_room_companion(uuid,uuid)'::regprocedure), 'choice RPC is SECURITY DEFINER with empty search_path');
select ok(not has_table_privilege('authenticated', 'public.room_nativas', 'UPDATE'), 'legacy visibility is no longer directly mutable');
select ok(not exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_companions'), 'companions are not published through Realtime');
select ok(not exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'nativas'), 'original fichas are not published through Realtime');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000000211','authenticated','authenticated','comp-master-a@example.test','',now()),
  ('00000000-0000-4000-8000-000000000212','authenticated','authenticated','comp-owner@example.test','',now()),
  ('00000000-0000-4000-8000-000000000213','authenticated','authenticated','comp-peer@example.test','',now()),
  ('00000000-0000-4000-8000-000000000214','authenticated','authenticated','comp-master-b@example.test','',now()),
  ('00000000-0000-4000-8000-000000000215','authenticated','authenticated','comp-outsider@example.test','',now());
insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-000000000211','Mestre A'),
  ('00000000-0000-4000-8000-000000000212','Dona'),
  ('00000000-0000-4000-8000-000000000213','Jogador'),
  ('00000000-0000-4000-8000-000000000214','Mestre B'),
  ('00000000-0000-4000-8000-000000000215','Externo');
insert into public.rooms (id, created_by, name) values
  ('10000000-0000-4000-8000-000000000221','00000000-0000-4000-8000-000000000211','Campanha A'),
  ('10000000-0000-4000-8000-000000000222','00000000-0000-4000-8000-000000000214','Campanha B');
insert into public.room_members (room_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000221','00000000-0000-4000-8000-000000000211','master'),
  ('10000000-0000-4000-8000-000000000221','00000000-0000-4000-8000-000000000212','player'),
  ('10000000-0000-4000-8000-000000000221','00000000-0000-4000-8000-000000000213','player'),
  ('10000000-0000-4000-8000-000000000222','00000000-0000-4000-8000-000000000214','master'),
  ('10000000-0000-4000-8000-000000000222','00000000-0000-4000-8000-000000000212','player'),
  ('10000000-0000-4000-8000-000000000222','00000000-0000-4000-8000-000000000213','player');
insert into public.room_state (room_id, revision, state, updated_by) values
  ('10000000-0000-4000-8000-000000000221',0,'{}','00000000-0000-4000-8000-000000000211'),
  ('10000000-0000-4000-8000-000000000222',0,'{}','00000000-0000-4000-8000-000000000214');
insert into public.room_events (room_id, revision, actor_id, event_type, payload) values
  ('10000000-0000-4000-8000-000000000221',0,'00000000-0000-4000-8000-000000000211','room_created','{}'),
  ('10000000-0000-4000-8000-000000000222',0,'00000000-0000-4000-8000-000000000214','room_created','{}');
insert into public.nativas (id, owner_id, local_id, format_version, data) values
  ('20000000-0000-4000-8000-000000000231','00000000-0000-4000-8000-000000000212','comp-source-one',2,'{"id":"comp-source-one","name":"Aruã","species":"Jaguatirica","groupBio":"Mamífero","lineage":"Felino","lineageName":"Felino","bioma":"Mata","affinity":"Terra","archetype":"Guardião","nivel":4,"xp":15,"attrs":{"FOR":2},"techniques":["T1"],"essencias":["E1"],"photoId":"photo-local","legacy":{"keep":true}}'),
  ('20000000-0000-4000-8000-000000000232','00000000-0000-4000-8000-000000000212','comp-source-two',2,'{"id":"comp-source-two","name":"Jatobá","nivel":1,"xp":0,"attrs":{"FOR":1}}'),
  ('20000000-0000-4000-8000-000000000233','00000000-0000-4000-8000-000000000213','peer-source',2,'{"id":"peer-source","name":"Guará","nivel":7,"xp":99,"attrs":{"FOR":8},"techniques":["private-technique"],"essencias":["private-essence"]}');
insert into public.room_nativas (room_id, nativa_id, owner_id, visibility) values
  ('10000000-0000-4000-8000-000000000221','20000000-0000-4000-8000-000000000231','00000000-0000-4000-8000-000000000212','visible');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000212","role":"authenticated"}',true);
select is((select count(*) from public.nativas where id='20000000-0000-4000-8000-000000000231'),1::bigint,'owner reads their own original ficha');
select is(public.choose_room_companion('10000000-0000-4000-8000-000000000221','20000000-0000-4000-8000-000000000231')->>'status','selected','player explicitly selects their own ficha');
select is(public.choose_room_companion('10000000-0000-4000-8000-000000000221','20000000-0000-4000-8000-000000000231')->>'status','already_selected','repeating the same selection is idempotent');
select is((select count(*) from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and player_id=auth.uid() and is_active),1::bigint,'one active companion exists for the player in this room');
select is((select count(*) from public.room_companions where source_local_id='comp-source-one' and campaign_data->>'id'='comp-source-one'),1::bigint,'campaign snapshot preserves local identity');
select ok((select campaign_data ? 'legacy' and campaign_data ? 'photoId' from public.room_companions where source_local_id='comp-source-one'),'campaign snapshot preserves unknown fields and photo reference without copying a Blob');
select is(public.save_room_companion((select id from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and player_id=auth.uid() and is_active),1,2,'{"id":"comp-source-one","name":"Aruã campanha A","species":"Jaguatirica","groupBio":"Mamífero","lineage":"Felino","lineageName":"Felino","bioma":"Mata","affinity":"Terra","archetype":"Guardião","nivel":5,"xp":20,"attrs":{"FOR":3},"techniques":["T2"],"essencias":["E2"],"photoId":"photo-local","legacy":{"keep":true}}')->>'status','saved','owner can progress their campaign-specific companion');
select is((select revision from public.room_companions where source_local_id='comp-source-one'),2::bigint,'campaign save increments only the companion revision');
select is(public.save_room_companion((select id from public.room_companions where source_local_id='comp-source-one'),1,2,'{"id":"comp-source-one","name":"stale overwrite"}')->>'status','conflict','stale campaign revision is rejected');
select is((select campaign_data->>'name' from public.room_companions where source_local_id='comp-source-one'),'Aruã campanha A','stale save preserves the latest campaign snapshot');
select is((select data->>'name' from public.nativas where id='20000000-0000-4000-8000-000000000231'),'Aruã','campaign progress does not modify the original ficha');
select is(public.choose_room_companion('10000000-0000-4000-8000-000000000221','20000000-0000-4000-8000-000000000232')->>'status','selected','player can switch their companion');
select is((select count(*) from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and player_id=auth.uid() and is_active),1::bigint,'switching keeps one active companion');
select is((select count(*) from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and player_id=auth.uid() and not is_active),1::bigint,'switching preserves the previous campaign record');
select is(public.choose_room_companion('10000000-0000-4000-8000-000000000222','20000000-0000-4000-8000-000000000231')->>'status','selected','same original can be chosen in a different room');
select is((select count(*) from public.room_companions where source_local_id='comp-source-one' and is_active),1::bigint,'companion activity is isolated by room');
select is((select count(*) from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and player_id=auth.uid()),2::bigint,'room history retains each prior selection');
select is(public.choose_room_companion('10000000-0000-4000-8000-000000000221','20000000-0000-4000-8000-000000000231')->>'status','selected','switching back reactivates the prior campaign instance');
select is((select revision from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and source_local_id='comp-source-one'),2::bigint,'reactivation preserves campaign progress and revision');
select is(public.save_room_companion((select id from public.room_companions where room_id='10000000-0000-4000-8000-000000000222' and source_local_id='comp-source-one'),1,2,'{"id":"comp-source-one","name":"Aruã campanha B","nivel":2,"xp":3}')->>'status','saved','same source has independent progress in another room');
select is((select campaign_data->>'name' from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and source_local_id='comp-source-one'),'Aruã campanha A','another rooms progression does not change this room');
select set_config('nativa_test.owner_companion_id',(select id::text from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and source_local_id='comp-source-one' and is_active),true);
select ok((select count(*)=1 from public.get_room_companions('10000000-0000-4000-8000-000000000221') where player_id=auth.uid() and companion_state='history'),'previous companion remains visible to its owner as history');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000213","role":"authenticated"}',true);
select is(public.choose_room_companion('10000000-0000-4000-8000-000000000221','20000000-0000-4000-8000-000000000233')->>'status','selected','another player can select their own ficha');
select is((select count(*) from public.nativas where id='20000000-0000-4000-8000-000000000231'),0::bigint,'legacy visible flag does not expose another player original ficha');
select is((select count(*) from public.room_nativas where room_id='10000000-0000-4000-8000-000000000221'),0::bigint,'legacy share rows are hidden from ordinary peers');
select is((select count(*) from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and player_id='00000000-0000-4000-8000-000000000212'),0::bigint,'direct REST query cannot read another player full companion row');
select ok((select campaign_data is null and preview ? 'name' and preview ? 'species' from public.get_room_companions('10000000-0000-4000-8000-000000000221') where player_id='00000000-0000-4000-8000-000000000212' and companion_state='active'),'RPC returns only the safe peer preview, not campaign JSON');
select ok(not (select preview ?| array['attrs','techniques','nivel','xp','xpa','essencias','historicoProgressao','source_local_id','revision'] from public.get_room_companions('10000000-0000-4000-8000-000000000221') where player_id='00000000-0000-4000-8000-000000000212' and companion_state='active'),'peer preview omits private combat and progression fields');
select is((select count(*) from public.get_room_companions('10000000-0000-4000-8000-000000000221') where player_id=auth.uid() and campaign_data is not null),1::bigint,'player receives their own complete companion');
select throws_ok($$select public.save_room_companion(current_setting('nativa_test.owner_companion_id')::uuid,1,2,'[]'::jsonb)$$,'42501',null,'player cannot edit another player companion before payload validation');
select is(public.save_nativa('30000000-0000-4000-8000-000000000241','comp-source-one',2,'{"id":"comp-source-one","name":"peer edit"}',1)->>'status','not_found','player cannot modify another owner original through save_nativa');
select throws_ok($$select public.choose_room_companion('10000000-0000-4000-8000-000000000221','20000000-0000-4000-8000-000000000231')$$,'42501',null,'player cannot choose another player original ficha');
select is((select count(*) from public.get_room_companions('10000000-0000-4000-8000-000000000221') where player_id=auth.uid() and companion_state='awaiting'),0::bigint,'chosen player is not shown as awaiting');
select throws_ok($$select public.update_room_name('10000000-0000-4000-8000-000000000221','peer rename')$$,'42501',null,'ordinary player cannot rename a room');
select throws_ok($$select public.kick_room_player('10000000-0000-4000-8000-000000000221','00000000-0000-4000-8000-000000000212')$$,'42501',null,'ordinary player cannot kick another participant');
select throws_ok($$select public.close_room('10000000-0000-4000-8000-000000000221','Campanha A')$$,'42501',null,'ordinary player cannot close a room');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000211","role":"authenticated"}',true);
select is((select count(*) from public.get_room_companions('10000000-0000-4000-8000-000000000221') where companion_state='active' and campaign_data is not null),2::bigint,'master reads complete data for every active room companion');
select is((select count(*) from public.nativas where owner_id='00000000-0000-4000-8000-000000000212'),2::bigint,'master may inspect original fichas of current room members');
select is((select count(*) from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and player_id='00000000-0000-4000-8000-000000000213' and campaign_data ? 'techniques'),1::bigint,'master direct read is complete for campaign companions');
select is(public.save_room_companion((select id from public.room_companions where source_local_id='peer-source' and is_active),1,2,'{"id":"peer-source","name":"Mestre ajustou campanha","nivel":8,"techniques":["T3"]}')->>'status','saved','master can edit the campaign companion through RPC');
select is((select data->>'name' from public.nativas where id='20000000-0000-4000-8000-000000000233'),'Guará','master campaign edit leaves original ficha untouched');
select is(public.save_nativa('30000000-0000-4000-8000-000000000242','peer-source',2,'{"id":"peer-source","name":"master edit"}',1)->>'status','not_found','master cannot edit player original ficha');
select is(public.update_room_name('10000000-0000-4000-8000-000000000221','Campanha Renomeada'),'Campanha Renomeada','master can rename the room');
select is((select name from public.rooms where id='10000000-0000-4000-8000-000000000221'),'Campanha Renomeada','room name change persists');
select throws_ok($$select public.kick_room_player('10000000-0000-4000-8000-000000000221','00000000-0000-4000-8000-000000000211')$$,'42501',null,'master cannot kick themself');
select public.kick_room_player('10000000-0000-4000-8000-000000000221','00000000-0000-4000-8000-000000000213');
select is((select count(*) from public.room_members where room_id='10000000-0000-4000-8000-000000000221' and user_id='00000000-0000-4000-8000-000000000213'),0::bigint,'master kick removes the player membership');
select ok((select count(*)=1 from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and player_id='00000000-0000-4000-8000-000000000213' and not is_active),'kick retires but preserves the player campaign record');
select ok((select count(*)=1 from public.get_room_companions('10000000-0000-4000-8000-000000000221') where player_id='00000000-0000-4000-8000-000000000213' and companion_state='history' and player_role='removed'),'master can review a removed player campaign history');

select throws_ok($$select public.close_room('10000000-0000-4000-8000-000000000221','wrong')$$,'22023',null,'room closure requires exact name confirmation');
select public.close_room('10000000-0000-4000-8000-000000000221','Campanha Renomeada');
select is((select status from public.rooms where id='10000000-0000-4000-8000-000000000221'),'closed','master closes the room without deleting it');
select is((select count(*) from public.nativas where owner_id='00000000-0000-4000-8000-000000000212'),2::bigint,'room closure does not delete original fichas');
select is((select count(*) from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and is_active),0::bigint,'room closure retires active companions');
select throws_ok($$select public.create_room_invite('10000000-0000-4000-8000-000000000221','code',now()+interval '1 hour',1)$$,'P0001',null,'closed room cannot issue invites');
select throws_ok($$select public.choose_room_companion('10000000-0000-4000-8000-000000000221','20000000-0000-4000-8000-000000000231')$$,'P0001',null,'closed room cannot change companion selection');
select ok((select count(*)=1 from public.room_events where room_id='10000000-0000-4000-8000-000000000221' and event_type='room_closed'),'room closure appends a recoverable event');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000215","role":"authenticated"}',true);
select throws_ok($$select * from public.get_room_companions('10000000-0000-4000-8000-000000000221')$$,'42501',null,'outsider cannot read room companions');
select is((select count(*) from public.room_companions where room_id='10000000-0000-4000-8000-000000000221'),0::bigint,'outsider cannot query companion rows through REST');

reset role;
delete from public.nativas where id='20000000-0000-4000-8000-000000000231';
select is((select source_nativa_id from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and source_local_id='comp-source-one'),null::uuid,'original deletion clears only the remote source reference');
select is((select campaign_data->>'name' from public.room_companions where room_id='10000000-0000-4000-8000-000000000221' and source_local_id='comp-source-one'),'Aruã campanha A','original deletion preserves the complete campaign snapshot');
select * from finish();
rollback;
