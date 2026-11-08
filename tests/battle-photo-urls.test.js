import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { criarRegistroUrlsFotosArena } from "../js/battle-photo-urls.js";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

function registroFake() {
  const criadas = [];
  const revogadas = [];
  const registro = criarRegistroUrlsFotosArena({
    criarUrl: blob => { const url = `blob:arena/${blob.id}`; criadas.push(url); return url; },
    revogarUrl: url => revogadas.push(url)
  });
  return { registro, criadas, revogadas };
}

test("todas as URLs criadas pela arena são registradas e só URLs próprias são liberadas", () => {
  const { registro, criadas, revogadas } = registroFake();
  const first = registro.criar({ id: "a" });
  const second = registro.criar({ id: "b" });
  assert.deepEqual(criadas, [first, second]);
  assert.equal(registro.quantidade(), 2);
  assert.equal(registro.liberar("blob:outra-parte-do-app"), false);
  assert.deepEqual(revogadas, []);
  assert.equal(registro.possui(first), true);
});

test("as URLs só são revogadas depois de remover referências da interface no fim da batalha", () => {
  const { registro, criadas, revogadas } = registroFake();
  criadas.push(registro.criar({ id: "a" }), registro.criar({ id: "b" }));
  registro.liberarTodasDepoisDe(() => {
    assert.deepEqual(revogadas, []);
    assert.equal(registro.quantidade(), 2);
  });
  assert.deepEqual(revogadas, ["blob:arena/a", "blob:arena/b"]);
  assert.equal(registro.quantidade(), 0);
});

test("substituição publica a nova foto antes de revogar a antiga; sem Blob pode usar fallback", () => {
  const { registro, revogadas } = registroFake();
  const antiga = registro.criar({ id: "antiga" });
  const nova = registro.substituir(antiga, { id: "nova" }, url => {
    assert.equal(url, "blob:arena/nova");
    assert.equal(registro.possui(url), true);
    assert.deepEqual(revogadas, []);
  });
  assert.equal(nova, "blob:arena/nova");
  assert.deepEqual(revogadas, [antiga]);
  assert.equal(registro.possui(nova), true);

  const fallback = registro.substituir(nova, null, url => {
    assert.equal(url, null);
    assert.equal(registro.possui(nova), true);
  });
  assert.equal(fallback, null);
  assert.deepEqual(revogadas, [antiga, nova]);
});

test("integração da arena carrega photoId, renderiza a imagem e limpa no fim e na troca de batalha", () => {
  assert.match(app, /const foto=await obterFoto\(c\.nativa\.photoId\);\s*substituirFotoCombatente\(c,foto\)/);
  assert.match(app, /c\.fotoUrl\s*\?`<img class="combatant-photo" src="\$\{c\.fotoUrl\}"/);
  assert.ok(app.includes('class="combatant-photo-placeholder" role="img"'));
  assert.match(app, /liberarFotosBatalha\(\);\s*\n\s*const combatentes=/);
  assert.match(app, /liberarFotosBatalha\(\{manterBatalha:true\}\)/);
  assert.match(app, /function liberarFotosBatalha[\s\S]*?combatente\.fotoUrl=null[\s\S]*?renderizarArena\(\)/);
});
