import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const legacyPrivacyMigration = readFileSync(new URL("../supabase/migrations/20261106010000_room_nativa_privacy.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261107000000_room_companions_and_admin.sql", import.meta.url), "utf8");
const authorizationOrderMigration = readFileSync(new URL("../supabase/migrations/20261107010000_room_companion_authorization_order.sql", import.meta.url), "utf8");
const databaseTest = readFileSync(new URL("../supabase/tests/database/20261106010001_room_nativa_privacy.test.sql", import.meta.url), "utf8");
const companionsTest = readFileSync(new URL("../supabase/tests/database/20261107000001_room_companions_and_admin.test.sql", import.meta.url), "utf8");
const concurrency = readFileSync(new URL("../supabase/tests/database/20261107000002_room_companion_concurrency.ps1", import.meta.url), "utf8");
const deleteRoomMigration = readFileSync(new URL("../supabase/migrations/20261107110000_delete_room.sql", import.meta.url), "utf8");
const deleteRoomTest = readFileSync(new URL("../supabase/tests/database/20261107110001_delete_room.test.sql", import.meta.url), "utf8");
const rooms = readFileSync(new URL("../js/rooms.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
const architecture = readFileSync(new URL("../docs/ARQUITETURA_MULTIPLAYER.md", import.meta.url), "utf8");

test("compatibilidade preserva a coluna de privacidade antiga sem tratá-la como autorização atual", () => {
  assert.match(legacyPrivacyMigration, /add column visibility text not null default 'private'/);
  assert.match(migration, /comment on column public\.room_nativas\.visibility[\s\S]*Legacy share setting/);
  assert.match(migration, /drop policy if exists room_nativas_select_owner_master_or_visible_member/);
  assert.match(migration, /drop policy if exists room_nativas_update_owner_visibility/);
  assert.match(migration, /revoke all on table public\.room_nativas from public, anon, authenticated/);
  assert.match(migration, /grant select on table public\.room_nativas to authenticated/);
  assert.doesNotMatch(migration, /rn\.visibility\s*=\s*'visible'/);
});

test("instância de campanha tem identidade, histórico e limite único por jogador e sala", () => {
  assert.match(migration, /create table public\.room_companions/);
  assert.match(migration, /source_nativa_id uuid references public\.nativas \(id\) on delete set null/);
  assert.match(migration, /source_local_id text not null/);
  assert.match(migration, /campaign_data jsonb not null check/);
  assert.match(migration, /campaign_data->>'id' = source_local_id/);
  assert.match(migration, /create unique index room_companions_one_active_per_player_room_idx[\s\S]*where is_active/);
  assert.match(migration, /where lc\.share_count = 1/);
  assert.match(migration, /If a player had several[\s\S]*leave the choice to them/);
});

test("RPCs derivam identidade da sessão, aplicam revisão e mantêm search_path seguro", () => {
  for (const name of ["choose_room_companion", "save_room_companion", "get_room_companions", "update_room_name", "kick_room_player", "close_room"]) {
    const declaration = new RegExp("create or replace function public\\." + name + "\\([\\s\\S]*?security definer[\\s\\S]*?set search_path = ''", "i");
    assert.match(migration, declaration, name + " is SECURITY DEFINER with an empty search_path");
  }
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /revision <> p_expected_revision/);
  assert.match(migration, /grant execute on function public\.get_room_companions\(uuid\) to authenticated/);
  assert.match(migration, /revoke all on function public\.get_room_companions\(uuid\) from public, anon, authenticated/);
  assert.match(migration, /revoke all on function public\.save_room_companion\(uuid, bigint, integer, jsonb\) from public, anon, authenticated/);
});

test("RPC de leitura separa JSON completo da prévia sem confiar na interface", () => {
  assert.match(migration, /then r\.c_data else null end/);
  assert.match(migration, /jsonb_build_object\([\s\S]*'name', r\.c_data->'name'[\s\S]*'archetype', r\.c_data->'archetype'/);
  assert.match(migration, /nativa_private\.can_view_room_companion_full\(room_id, player_id\)/);
  assert.match(migration, /create policy room_companions_select_owner_or_master/);
  assert.doesNotMatch(migration, /grant insert, update, delete on table public\.room_companions to authenticated/);
  assert.match(companionsTest, /RPC returns only the safe peer preview, not campaign JSON/);
  assert.match(companionsTest, /peer preview omits private combat and progression fields/);
  assert.match(companionsTest, /master reads complete data for every active room companion/);
  assert.match(databaseTest, /species":"Onça/);
});

test("RPC de gravação autoriza o registro antes de validar payload e mantém privilégios seguros", () => {
  const rowLookup = authorizationOrderMigration.indexOf("from public.room_companions c");
  const permissionCheck = authorizationOrderMigration.indexOf("room companion access denied");
  const payloadValidation = authorizationOrderMigration.indexOf("invalid campaign companion update");
  assert.ok(rowLookup >= 0 && permissionCheck > rowLookup && payloadValidation > permissionCheck);
  assert.match(authorizationOrderMigration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(authorizationOrderMigration, /revoke all on function public\.save_room_companion\(uuid, bigint, integer, jsonb\) from public, anon, authenticated/i);
  assert.match(authorizationOrderMigration, /grant execute on function public\.save_room_companion\(uuid, bigint, integer, jsonb\) to authenticated/i);
  assert.match(databaseTest, /peer authorization is checked before malformed campaign payload/);
});

test("administração mantém autoria do mestre e encerra sem apagar fichas originais", () => {
  assert.match(migration, /v_creator <> auth\.uid\(\) or not nativa_private\.is_room_master/);
  assert.match(migration, /create or replace function public\.update_room_name/);
  assert.match(migration, /create or replace function public\.kick_room_player/);
  assert.match(migration, /create or replace function public\.close_room/);
  assert.match(migration, /update public\.room_companions c[\s\S]*set is_active = false/);
  assert.match(migration, /update public\.rooms set status = 'closed'/);
  assert.match(companionsTest, /master kick removes the player membership/);
  assert.match(companionsTest, /room closure does not delete original fichas/);
});

test("interface usa RPC de companheiros e oferece administração somente ao mestre", () => {
  assert.match(html, /Companheiros da sala/);
  assert.match(html, /id="online-room-admin"[^>]*hidden/);
  assert.match(html, /id="online-choose-room-companion-form"[^>]*hidden/);
  assert.match(html, /id="online-close-room"/);
  assert.match(rooms, /client\.rpc\("get_room_companions"/);
  assert.match(rooms, /client\.rpc\("choose_room_companion"/);
  assert.match(rooms, /client\.rpc\("save_room_companion"/);
  assert.match(rooms, /client\.rpc\("update_room_name"/);
  assert.match(rooms, /client\.rpc\("kick_room_player"/);
  assert.match(rooms, /client\.rpc\("close_room"/);
  assert.doesNotMatch(rooms, /\.from\("room_nativas"\)/);
  assert.doesNotMatch(rooms, /\.in\("id", \[\.\.\.ids\]\)/);
});

test("testes SQL cobrem matriz de acesso e teste concorrente exige duas sessões na barreira", () => {
  assert.match(databaseTest, /plan\(41\)/);
  assert.match(databaseTest, /peer cannot read another player original/);
  assert.match(databaseTest, /peer authorization is checked before malformed campaign payload/);
  assert.match(companionsTest, /plan\(73\)/);
  assert.match(companionsTest, /two active companion|one active companion/i);
  assert.match(concurrency, /127\.0\.0\.1/);
  assert.match(concurrency, /54322/);
  assert.match(concurrency, /supabase_db_NATIVA_Prototipo_Atualizado/);
  assert.match(concurrency, /Both workers did not reach the lock barrier/);
  assert.match(concurrency, /count\(\*\) filter \(where is_active\)/);
  assert.match(concurrency, /delete from public\.rooms where id='\$roomId'/);
  assert.match(architecture, /instância independente de campanha/i);
});

test("RPC de exclusão permanente restringe o criador-mestre e depende de cascades da sala", () => {
  assert.match(deleteRoomMigration, /security definer[\s\S]*set search_path = ''/i);
  assert.match(deleteRoomMigration, /v_creator <> v_user_id or not nativa_private\.is_room_master/);
  assert.ok(deleteRoomMigration.indexOf("p_confirmation is distinct from v_name") < deleteRoomMigration.indexOf("delete from public.rooms"));
  assert.match(deleteRoomMigration, /revoke all on function public\.delete_room\(uuid, text\) from public, anon, authenticated/i);
  assert.match(deleteRoomMigration, /grant execute on function public\.delete_room\(uuid, text\) to authenticated/i);
  assert.match(deleteRoomTest, /plan\(22\)/);
  for (const coverage of ["ordinary player cannot delete", "external user cannot delete", "master of another room cannot delete", "master must confirm the exact room name", "campaign companions and history are cascaded", "original player Nativa is preserved"]) {
    assert.ok(deleteRoomTest.includes(coverage), `missing deletion test: ${coverage}`);
  }
});

test("interface separa encerramento e exclusão destrutiva, exigindo duas confirmações", () => {
  assert.match(html, /id="online-close-room"[^>]*>Encerrar sala/);
  assert.match(html, /id="online-delete-room"[^>]*>Apagar sala definitivamente/);
  assert.match(html, /room-delete-zone/);
  assert.match(rooms, /membrosDaSala\.get\(salaSelecionada\.id\) !== "master" \|\| salaSelecionada\.created_by !== usuarioAtual\?\.id/);
  assert.match(rooms, /window\.confirm\(`Apagar permanentemente a sala/);
  assert.match(rooms, /window\.prompt\("Para confirmar a exclusão permanente/);
  assert.match(rooms, /client\.rpc\("delete_room"/);
  assert.match(css, /\.room-delete-button\{[^}]*background:#852f32/);
});

test("ficha visual usa imagem local, catálogo real e somente o payload de prévia autorizado", () => {
  assert.match(rooms, /repositorioLocal\.obterFoto\(data\.photoId\)/);
  assert.match(rooms, /obterTecnicaPorId\(id\)/);
  assert.match(rooms, /const safePreview = row\.preview/);
  assert.match(rooms, /campaign_data.*typeof row\.campaign_data/);
  assert.match(rooms, /room-companion-stats/);
  assert.match(rooms, /valorNumerico\(data\.nivel\)/);
  assert.match(css, /\.room-companion-portrait img[^}]*object-fit:contain/);
  assert.match(css, /@media\(max-width:480px\)\{[^}]*room-companion-hero/);
  assert.match(rooms, /URL\.revokeObjectURL\(url\)/);
});

test("painel visual de campanha substitui edição JSON e só é construído para o mestre", () => {
  assert.match(rooms, /campaign && row\?\.companion_state === "active" && salaAberta && isMaster/);
  assert.match(rooms, /Administrar Nativa/);
  assert.doesNotMatch(rooms, /Dados JSON da campanha|data-companion-editor|data-save-room-companion/);
  assert.match(rooms, /client\.rpc\("save_room_companion"/);
  assert.match(rooms, /p_expected_revision: Number\(row\.revision\)/);
  assert.match(rooms, /concederXpCampanha/);
  assert.match(rooms, /definirNivelCampanha/);
  assert.match(rooms, /concederEssenciaCampanha/);
  assert.match(rooms, /concederTracoCampanha/);
  assert.match(rooms, /concederTecnicaCampanha/);
  assert.match(rooms, /window\.confirm\(`Remover/);
  assert.match(rooms, /Remoção indisponível: o histórico não liga cada Essência/);
});
