begin;
select plan(22);

select ok(has_function_privilege('authenticated','public.delete_room(uuid,text)','EXECUTE'),'authenticated can call room deletion RPC');
select ok(not has_function_privilege('anon','public.delete_room(uuid,text)','EXECUTE'),'anonymous users cannot call room deletion RPC');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.delete_room(uuid,text)'::regprocedure),'room deletion RPC is SECURITY DEFINER with empty search_path');

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000000411','authenticated','authenticated','delete-master@example.test','',now()),
 ('00000000-0000-4000-8000-000000000412','authenticated','authenticated','delete-player@example.test','',now()),
 ('00000000-0000-4000-8000-000000000413','authenticated','authenticated','delete-outsider@example.test','',now()),
 ('00000000-0000-4000-8000-000000000414','authenticated','authenticated','delete-other-master@example.test','',now());
insert into public.rooms (id,created_by,name) values
 ('10000000-0000-4000-8000-000000000421','00000000-0000-4000-8000-000000000411','Sala descartável'),
 ('10000000-0000-4000-8000-000000000422','00000000-0000-4000-8000-000000000414','Sala preservada');
insert into public.room_members (room_id,user_id,role) values
 ('10000000-0000-4000-8000-000000000421','00000000-0000-4000-8000-000000000411','master'),
 ('10000000-0000-4000-8000-000000000421','00000000-0000-4000-8000-000000000412','player'),
 ('10000000-0000-4000-8000-000000000422','00000000-0000-4000-8000-000000000414','master');
insert into public.room_state (room_id,revision,state,updated_by) values
 ('10000000-0000-4000-8000-000000000421',0,'{}','00000000-0000-4000-8000-000000000411'),
 ('10000000-0000-4000-8000-000000000422',0,'{}','00000000-0000-4000-8000-000000000414');
insert into public.room_events (room_id,revision,actor_id,event_type,payload) values
 ('10000000-0000-4000-8000-000000000421',0,'00000000-0000-4000-8000-000000000411','room_created','{}');
insert into public.room_invites (room_id,kind,token_hash,created_by,expires_at,max_uses)
values ('10000000-0000-4000-8000-000000000421','code',decode(repeat('91',32),'hex'),'00000000-0000-4000-8000-000000000411',now()+interval '1 day',1);
insert into public.nativas (id,owner_id,local_id,format_version,data) values
 ('20000000-0000-4000-8000-000000000431','00000000-0000-4000-8000-000000000412','delete-room-source',2,'{"id":"delete-room-source","name":"Nativa preservada","attrs":{"ATQ":1}}');
insert into public.room_nativas (room_id,nativa_id,owner_id,visibility)
values ('10000000-0000-4000-8000-000000000421','20000000-0000-4000-8000-000000000431','00000000-0000-4000-8000-000000000412','visible');
insert into public.room_actions (room_id,player_id,turn_number,action)
values ('10000000-0000-4000-8000-000000000421','00000000-0000-4000-8000-000000000412',1,'{"type":"fixture"}');
insert into public.room_companions (room_id,player_id,source_nativa_id,source_local_id,format_version,campaign_data)
values ('10000000-0000-4000-8000-000000000421','00000000-0000-4000-8000-000000000412','20000000-0000-4000-8000-000000000431','delete-room-source',2,'{"id":"delete-room-source","name":"Snapshot da campanha"}');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000412","role":"authenticated"}',true);
select throws_ok($$select public.delete_room('10000000-0000-4000-8000-000000000421','Sala descartável')$$,'42501',null,'ordinary player cannot delete the room');
reset role;
select is((select count(*) from public.rooms where id='10000000-0000-4000-8000-000000000421'),1::bigint,'player denial preserves the room');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000413","role":"authenticated"}',true);
select throws_ok($$select public.delete_room('10000000-0000-4000-8000-000000000421','Sala descartável')$$,'42501',null,'external user cannot delete the room');
reset role;
select is((select count(*) from public.rooms where id='10000000-0000-4000-8000-000000000421'),1::bigint,'outsider denial preserves the room');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000414","role":"authenticated"}',true);
select throws_ok($$select public.delete_room('10000000-0000-4000-8000-000000000421','Sala descartável')$$,'42501',null,'master of another room cannot delete this room');
reset role;
select is((select count(*) from public.rooms where id='10000000-0000-4000-8000-000000000421'),1::bigint,'other-room master denial preserves the target room');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000411","role":"authenticated"}',true);
select throws_ok($$select public.delete_room('10000000-0000-4000-8000-000000000421','nome errado')$$,'22023',null,'master must confirm the exact room name');
reset role;
select is((select count(*) from public.rooms where id='10000000-0000-4000-8000-000000000421'),1::bigint,'wrong confirmation changes nothing');
set local role authenticated;
select lives_ok($$select public.delete_room('10000000-0000-4000-8000-000000000421','Sala descartável')$$,'creator-master can delete the room permanently');
reset role;

select is((select count(*) from public.rooms where id='10000000-0000-4000-8000-000000000421'),0::bigint,'deleted room is absent');
select is((select count(*) from public.room_members where room_id='10000000-0000-4000-8000-000000000421'),0::bigint,'room participants are cascaded');
select is((select count(*) from public.room_invites where room_id='10000000-0000-4000-8000-000000000421'),0::bigint,'room invites are cascaded');
select is((select count(*) from public.room_nativas where room_id='10000000-0000-4000-8000-000000000421'),0::bigint,'legacy room associations are cascaded');
select is((select count(*) from public.room_companions where room_id='10000000-0000-4000-8000-000000000421'),0::bigint,'campaign companions and history are cascaded');
select is((select count(*) from public.room_state where room_id='10000000-0000-4000-8000-000000000421'),0::bigint,'room state is cascaded');
select is((select count(*) from public.room_events where room_id='10000000-0000-4000-8000-000000000421'),0::bigint,'room event history is cascaded');
select is((select count(*) from public.room_actions where room_id='10000000-0000-4000-8000-000000000421'),0::bigint,'room actions are cascaded');
select is((select count(*) from public.nativas where id='20000000-0000-4000-8000-000000000431' and owner_id='00000000-0000-4000-8000-000000000412'),1::bigint,'original player Nativa is preserved');
select is((select count(*) from public.rooms where id='10000000-0000-4000-8000-000000000422'),1::bigint,'unrelated room is preserved');

select * from finish();
rollback;
