begin;
select plan(41);

select ok((select relrowsecurity from pg_class where oid='public.room_nativas'::regclass),'legacy room_nativas remains behind RLS');
select ok((select relrowsecurity from pg_class where oid='public.nativas'::regclass),'original fichas remain behind RLS');
select ok((select relrowsecurity from pg_class where oid='public.room_companions'::regclass),'campaign companions remain behind RLS');
select ok(has_column_privilege('authenticated','public.room_nativas','visibility','SELECT'),'legacy visibility remains readable for compatibility');
select ok(not has_table_privilege('authenticated','public.room_nativas','INSERT'),'clients cannot create legacy share rows');
select ok(not has_table_privilege('authenticated','public.room_nativas','UPDATE'),'clients cannot change legacy visibility');
select ok(not has_table_privilege('authenticated','public.room_nativas','DELETE'),'clients cannot remove legacy share rows');
select ok(has_function_privilege('authenticated','nativa_private.can_view_shared_nativa(uuid)','EXECUTE'),'authenticated RLS can call the internal original-ficha predicate');
select ok(not has_function_privilege('anon','nativa_private.can_view_shared_nativa(uuid)','EXECUTE'),'anonymous cannot execute the internal original-ficha predicate');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='nativa_private.can_view_shared_nativa(uuid)'::regprocedure),'original-ficha predicate is SECURITY DEFINER with empty search_path');
select ok(not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='nativas'),'original fichas are excluded from Postgres Changes');
select ok(not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='room_nativas'),'legacy share rows are excluded from Postgres Changes');
select ok(not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='room_companions'),'campaign companions are excluded from Postgres Changes');
select ok(has_function_privilege('authenticated','public.get_room_companions(uuid)','EXECUTE'),'authenticated users read room companions only through the protected RPC');

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000311','authenticated','authenticated','privacy-master@example.test','',now()),
 ('00000000-0000-4000-8000-000000000312','authenticated','authenticated','privacy-owner@example.test','',now()),
 ('00000000-0000-4000-8000-000000000313','authenticated','authenticated','privacy-peer@example.test','',now()),
 ('00000000-0000-4000-8000-000000000314','authenticated','authenticated','privacy-outsider@example.test','',now());
insert into public.profiles (id,display_name) values
 ('00000000-0000-4000-8000-000000000311','Mestre'),
 ('00000000-0000-4000-8000-000000000312','Dona'),
 ('00000000-0000-4000-8000-000000000313','Jogador'),
 ('00000000-0000-4000-8000-000000000314','Externo');
insert into public.rooms (id,created_by,name) values
 ('10000000-0000-4000-8000-000000000321','00000000-0000-4000-8000-000000000311','Privacidade A'),
 ('10000000-0000-4000-8000-000000000322','00000000-0000-4000-8000-000000000311','Privacidade B');
insert into public.room_members (room_id,user_id,role) values
 ('10000000-0000-4000-8000-000000000321','00000000-0000-4000-8000-000000000311','master'),
 ('10000000-0000-4000-8000-000000000321','00000000-0000-4000-8000-000000000312','player'),
 ('10000000-0000-4000-8000-000000000321','00000000-0000-4000-8000-000000000313','player'),
 ('10000000-0000-4000-8000-000000000322','00000000-0000-4000-8000-000000000311','master'),
 ('10000000-0000-4000-8000-000000000322','00000000-0000-4000-8000-000000000312','player');
insert into public.room_state (room_id,revision,state,updated_by) values
 ('10000000-0000-4000-8000-000000000321',0,'{}','00000000-0000-4000-8000-000000000311'),
 ('10000000-0000-4000-8000-000000000322',0,'{}','00000000-0000-4000-8000-000000000311');
insert into public.room_events (room_id,revision,actor_id,event_type,payload) values
 ('10000000-0000-4000-8000-000000000321',0,'00000000-0000-4000-8000-000000000311','room_created','{}'),
 ('10000000-0000-4000-8000-000000000322',0,'00000000-0000-4000-8000-000000000311','room_created','{}');
insert into public.nativas (id,owner_id,local_id,format_version,data) values
 ('20000000-0000-4000-8000-000000000331','00000000-0000-4000-8000-000000000312','privacy-original',2,'{"id":"privacy-original","name":"Jatobá","species":"Onça","groupBio":"Mamífero","lineage":"Felino","bioma":"Mata","affinity":"Terra","archetype":"Guardião","attrs":{"FOR":4},"techniques":["privada"],"nivel":4,"xp":20,"essencias":["secreta"],"photoId":"local-photo","legacy":{"preserve":true}}'),
 ('20000000-0000-4000-8000-000000000332','00000000-0000-4000-8000-000000000313','privacy-peer','2','{"id":"privacy-peer","name":"Guará","species":"Lobo","groupBio":"Mamífero","lineage":"Canídeo","bioma":"Cerrado","affinity":"Ar","archetype":"Batedor","attrs":{"FOR":8},"techniques":["oculta"],"nivel":9,"xp":99,"essencias":["restrita"]}');
insert into public.room_nativas (room_id,nativa_id,owner_id,visibility)
values ('10000000-0000-4000-8000-000000000321','20000000-0000-4000-8000-000000000331','00000000-0000-4000-8000-000000000312','visible');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000312","role":"authenticated"}',true);
select is((select count(*) from public.nativas where id='20000000-0000-4000-8000-000000000331'),1::bigint,'owner always reads their original ficha');
select is(public.choose_room_companion('10000000-0000-4000-8000-000000000321','20000000-0000-4000-8000-000000000331')->>'status','selected','owner explicitly chooses the ficha as room companion');
select is(public.choose_room_companion('10000000-0000-4000-8000-000000000321','20000000-0000-4000-8000-000000000331')->>'status','already_selected','same selection is idempotent');
select is((select count(*) from public.get_room_companions('10000000-0000-4000-8000-000000000321') where player_id=auth.uid() and campaign_data is not null),1::bigint,'owner receives the complete campaign ficha');
select is((select campaign_data->'legacy' from public.room_companions where source_local_id='privacy-original'), '{"preserve":true}'::jsonb,'unknown fields survive companion initialization');
select is((select campaign_data->>'photoId' from public.room_companions where source_local_id='privacy-original'),'local-photo','campaign snapshot preserves only the local photo identifier');
select is(public.save_room_companion((select id from public.room_companions where source_local_id='privacy-original'),1,2,'{"id":"privacy-original","name":"Campanha","species":"Onça","groupBio":"Mamífero","lineage":"Felino","bioma":"Mata","affinity":"Terra","archetype":"Guardião","attrs":{"FOR":5},"techniques":["nova"],"nivel":5,"xp":30,"essencias":["nova"]}')->>'status','saved','owner can edit campaign data');
select is((select data->>'name' from public.nativas where id='20000000-0000-4000-8000-000000000331'),'Jatobá','campaign edits do not mutate the original ficha');
select set_config('nativa_test.owner_companion_id',(select id::text from public.room_companions where source_local_id='privacy-original'),true);

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000313","role":"authenticated"}',true);
select is(public.choose_room_companion('10000000-0000-4000-8000-000000000321','20000000-0000-4000-8000-000000000332')->>'status','selected','peer explicitly chooses their own companion');
select is((select count(*) from public.nativas where id='20000000-0000-4000-8000-000000000331'),0::bigint,'peer cannot read another player original even when legacy visibility says visible');
select is((select count(*) from public.room_nativas where room_id='10000000-0000-4000-8000-000000000321'),0::bigint,'peer cannot read legacy share metadata');
select is((select count(*) from public.room_companions where source_local_id='privacy-original'),0::bigint,'peer cannot query another players full companion via REST');
select ok((select campaign_data is null and preview ? 'name' and preview ? 'species' from public.get_room_companions('10000000-0000-4000-8000-000000000321') where player_id='00000000-0000-4000-8000-000000000312' and companion_state='active'),'peer RPC result contains presentation preview and no campaign JSON');
select ok(not (select preview ?| array['attrs','techniques','nivel','xp','essencias','legacy','photoId','source_local_id','revision'] from public.get_room_companions('10000000-0000-4000-8000-000000000321') where player_id='00000000-0000-4000-8000-000000000312' and companion_state='active'),'peer preview excludes combat, progression, and unknown private fields');
select is((select count(*) from public.get_room_companions('10000000-0000-4000-8000-000000000321') where player_id=auth.uid() and campaign_data is not null),1::bigint,'peer receives complete data for their own companion');
select throws_ok($$select public.save_room_companion(current_setting('nativa_test.owner_companion_id')::uuid,1,2,'[]'::jsonb)$$,'42501',null,'peer authorization is checked before malformed campaign payload');
select throws_ok($$select public.choose_room_companion('10000000-0000-4000-8000-000000000321','20000000-0000-4000-8000-000000000331')$$,'42501',null,'peer cannot associate another owners original ficha');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000311","role":"authenticated"}',true);
select is((select count(*) from public.nativas where owner_id='00000000-0000-4000-8000-000000000312'),1::bigint,'master can inspect a member original ficha');
select is((select count(*) from public.get_room_companions('10000000-0000-4000-8000-000000000321') where companion_state='active' and campaign_data is not null),2::bigint,'master receives full campaign data for all active companions');
select is((select count(*) from public.room_companions where source_local_id='privacy-peer' and campaign_data ? 'techniques'),1::bigint,'master can read the complete campaign row directly');
select is(public.save_room_companion((select id from public.room_companions where source_local_id='privacy-peer'),1,2,'{"id":"privacy-peer","name":"Mestre campanha","nivel":10,"techniques":["revista"]}')->>'status','saved','master can edit peer campaign companion');
select is((select data->>'name' from public.nativas where id='20000000-0000-4000-8000-000000000332'),'Guará','master campaign edit cannot change the original ficha');
select is(public.save_nativa('30000000-0000-4000-8000-000000000341','privacy-original',2,'{"id":"privacy-original","name":"master edit"}',1)->>'status','not_found','master cannot edit an owners original through sync RPC');
select throws_ok($$update public.room_nativas set visibility='private' where nativa_id='20000000-0000-4000-8000-000000000331'$$,'42501',null,'master cannot mutate legacy privacy settings');

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000314","role":"authenticated"}',true);
select throws_ok($$select * from public.get_room_companions('10000000-0000-4000-8000-000000000321')$$,'42501',null,'external user cannot call companion RPC');
select is((select count(*) from public.nativas where id='20000000-0000-4000-8000-000000000331'),0::bigint,'external user cannot read original ficha');
select is((select count(*) from public.room_companions),0::bigint,'external user cannot read campaign JSON directly');

reset role;
select * from finish();
rollback;
