alter table public.player_preferences drop constraint player_preferences_arena_speed_check;
alter table public.player_preferences add constraint player_preferences_arena_speed_check
  check (arena_speed in ('very_fast','fast','normal','slow','very_slow'));
