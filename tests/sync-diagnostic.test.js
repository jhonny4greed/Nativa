import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./sync-diagnostic.js", import.meta.url), "utf8");
const diagnosticHtml = readFileSync(new URL("./sync-diagnostic.html", import.meta.url), "utf8");
const appHtml = readFileSync(new URL("../app.html", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../js/auth.js", import.meta.url), "utf8");

test("acesso ao diagnóstico fica dentro da área autenticada e retorna ao NATIVA na mesma origem", () => {
  assert.match(appHtml, /<div id="online-account-details" hidden>[\s\S]*?<a id="online-open-sync-diagnostic" href="\.\/tests\/sync-diagnostic\.html">Diagnóstico de sincronização<\/a>[\s\S]*?<\/div>/);
  assert.match(diagnosticHtml, /<a id="return-to-nativa" href="\.\.\/index\.html">Voltar ao NATIVA<\/a>/);
});

test("diagnóstico e NATIVA compartilham o cliente e a sessão persistente existente", () => {
  assert.match(source, /import \{ obterClienteSupabase \} from "\.\.\/js\/auth\.js"/);
  assert.match(source, /client = await obterClienteSupabase\(\);\s*await refreshDiagnostic\(\);/);
  assert.match(source, /const \{ data, error \} = await client\.auth\.getSession\(\);[\s\S]*?currentSession = data\?\.session \|\| null;/);
  assert.match(authSource, /persistSession:\s*true/);
  assert.match(diagnosticHtml, /Inicializando cliente e consultando sessão/);
  assert.match(source, /Sem sessão ativa\. Volte ao NATIVA, entre na conta e abra novamente este diagnóstico/);
});

test("ferramenta de diagnóstico importa os módulos reais e limita o destino a loopback", () => {
  assert.match(source, /from "\.\.\/js\/repository\.js"/);
  assert.match(source, /from "\.\.\/js\/sync-service\.js"/);
  assert.match(source, /from "\.\.\/js\/auth\.js"/);
  assert.match(source, /new Set\(\["127\.0\.0\.1", "localhost"\]\)/);
  assert.match(source, /nativa-2d3d-diagnostic-/);
  assert.match(source, /globalThis\.indexedDB/);
  assert.doesNotMatch(source, /indexedDBApi\s*=|new Map\(/);
});

test("sincronização do diagnóstico filtra a fila para a fixture e só roda por clique", () => {
  assert.match(source, /operation\.localId === localId/);
  assert.match(source, /buttons\.sync\.addEventListener\("click"/);
  assert.match(source, /buttons\.syncDelete\.addEventListener\("click"/);
  assert.equal((source.match(/\.sincronizar\(\)/g) || []).length, 2);
  assert.match(source, /createFixtureScopedSyncService\(currentMarker\.localId\)\.sincronizar\(\)/);
  assert.match(source, /ensureOwner\(\);/);
});
