alter table public.player_preferences
  add column music_enabled boolean not null default true,
  add column music_mode text not null default 'standard' check (music_mode in ('standard','random','selected')),
  add column music_track text;
