-- All fixtures, including Storage metadata and auth users, are rolled back.
begin;
insert into auth.users (id, email, aud, role) values
('3ca3f154-63bd-4421-93dd-3535cc19c8a1','sound-a@example.test','authenticated','authenticated'),
('3ca3f154-63bd-4421-93dd-3535cc19c8b2','sound-b@example.test','authenticated','authenticated'),
('3ca3f154-63bd-4421-93dd-3535cc19c8c3','sound-c@example.test','authenticated','authenticated');
insert into public.arena_matches (host_id, guest_id, mode, host_ficha, guest_ficha, status) values
('3ca3f154-63bd-4421-93dd-3535cc19c8a1','3ca3f154-63bd-4421-93dd-3535cc19c8b2','private','{"id":"sound-duel"}','{"id":"other-native"}','active');
insert into storage.objects (bucket_id,name) values
('nativa-sounds','3ca3f154-63bd-4421-93dd-3535cc19c8a1/sound-private/cry.wav'),
('nativa-sounds','3ca3f154-63bd-4421-93dd-3535cc19c8a1/sound-duel/cry.wav');

set local role authenticated;
set local request.jwt.claims = '{"sub":"3ca3f154-63bd-4421-93dd-3535cc19c8a1","role":"authenticated"}';
do $$ begin
  if (select count(*) from storage.objects where bucket_id='nativa-sounds' and name like '3ca3f154-63bd-4421-93dd-3535cc19c8a1/%') <> 2 then
    raise exception 'owner cannot read both sounds';
  end if;
end $$;
insert into storage.objects (bucket_id,name) values ('nativa-sounds','3ca3f154-63bd-4421-93dd-3535cc19c8a1/sound-private/attack.wav');

set local request.jwt.claims = '{"sub":"3ca3f154-63bd-4421-93dd-3535cc19c8b2","role":"authenticated"}';
do $$ begin
  if exists(select 1 from storage.objects where bucket_id='nativa-sounds' and name like '3ca3f154-63bd-4421-93dd-3535cc19c8a1/sound-private/%') then
    raise exception 'unshared private audio leaked';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='nativa-sounds' and name='3ca3f154-63bd-4421-93dd-3535cc19c8a1/sound-duel/cry.wav') then
    raise exception 'opponent cannot read duel audio';
  end if;
end $$;
set local request.jwt.claims = '{"sub":"3ca3f154-63bd-4421-93dd-3535cc19c8c3","role":"authenticated"}';
do $$ begin
  if exists(select 1 from storage.objects where bucket_id='nativa-sounds' and name like '3ca3f154-63bd-4421-93dd-3535cc19c8a1/%') then
    raise exception 'unrelated account can read another account sounds';
  end if;
  begin
    insert into storage.objects (bucket_id,name) values ('nativa-sounds','3ca3f154-63bd-4421-93dd-3535cc19c8a1/sound-private/intruder.wav');
    raise exception 'unrelated account can write another account sounds';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
