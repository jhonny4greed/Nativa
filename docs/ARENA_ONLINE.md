# Arena online

Duels are friendly 1v1 matches. Players need an authenticated account and at
least one Nativa in their account's synced collection. Local-only fichas and
photos stay on that device. A duel snapshots the selected synced ficha; it
does not write match damage, experience, or rewards back to it.

Players can keep a private code/link, challenge an available player, or enter
automatic matchmaking. Presence expires after 70 seconds without a heartbeat;
waiting invitations expire after 15 minutes. An active match with no activity
for five minutes ends as a timeout. Turn choices remain hidden until both
players confirm. The server validates each choice, resolves the shared combat
domain, and stores the state before either client can read it. If a saved
offensive action becomes invalid during a simultaneous turn, the server applies
the documented defensive fallback so the match can continue.

The arena uses transparent WebP cutouts for the five supplied species. Original
art is retained separately for collection cards. Generated prompt metadata is
in `assets/generated/arena-art-prompts.json`.

## Deploy

The migration is `supabase/migrations/20261109020000_online_arena.sql`.
Deploy it through the established Supabase migration process, then deploy the
`arena-online` Edge Function. Set `verify_jwt = false` for the gateway because
the handler itself validates the bearer token against Supabase Auth before
accepting any request. The Edge Function requires the project's service-role
secret only in its server environment; never put that secret in the frontend.

After configuring a local Supabase stack, run `npm run test:online:local` for
an end-to-end test against local Auth and Postgres. `npm run combat:sync`
copies the canonical combat modules to the Edge Function's shared directory.
