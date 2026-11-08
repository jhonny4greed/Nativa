import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LINHAGENS } from "../js/data.js";
import { criarNativa } from "../js/nativa-domain.js";
import { CATALOGO_TRACOS, obterTracoPorId, nativaPossuiTraco, obterTracosComunsLinhagem, obterTracosPadraoLinhagem } from "../js/traits.js";

const esperados = {
  "Felinos": ["Quadrúpede", "Cauda", "Garras", "Presas", "Faro desenvolvido"],
  "Canídeos": ["Quadrúpede", "Cauda", "Presas", "Faro desenvolvido", "Audição aguçada"],
  "Mustelídeos": ["Quadrúpede", "Cauda", "Garras", "Presas"],
  "Procionídeos": ["Quadrúpede", "Cauda", "Garras", "Faro desenvolvido"],
  "Roedores": ["Quadrúpede", "Cauda", "Garras"],
  "Marsupiais": ["Quadrúpede", "Cauda", "Garras"],
  "Primatas": ["Bípede", "Arborícola", "Cauda", "Visão aguçada"],
  "Morcegos": ["Asas", "Voador", "Ecolocalização"],
  "Xenartros": ["Quadrúpede", "Garras", "Escavador"],
  "Ungulados": ["Quadrúpede", "Couro espesso", "Faro desenvolvido"],
  "Aves de rapina": ["Bípede", "Asas", "Voador", "Garras", "Visão aguçada"],
  "Aves corredoras e campestres": ["Bípede", "Asas", "Garras"],
  "Aves aquáticas e pernaltas": ["Bípede", "Asas", "Voador"],
  "Psitacídeos": ["Bípede", "Asas", "Voador", "Bico"],
  "Serpentes": ["Ápode", "Escamas", "Mandíbulas poderosas"],
  "Lagartos": ["Quadrúpede", "Escamas", "Cauda"],
  "Quelônios": ["Carapaça", "Escamas"],
  "Crocodilianos": ["Quadrúpede", "Escamas", "Cauda", "Mandíbulas poderosas", "Semiaquático"],
  "Anuros": ["Pele mucosa"],
  "Peixes elétricos": ["Aquático", "Nadadeiras", "Descarga elétrica", "Sensibilidade elétrica"],
  "Characiformes": ["Aquático", "Nadadeiras"],
  "Siluriformes": ["Aquático", "Nadadeiras", "Barbilhões"],
  "Peixes cartilaginosos": ["Aquático", "Nadadeiras", "Escamas"],
  "Aracnídeos": ["Exoesqueleto", "Peçonha"],
  "Insetos sociais": ["Exoesqueleto"],
  "Insetos predadores": ["Exoesqueleto", "Mandíbulas poderosas"],
  "Crustáceos": ["Exoesqueleto", "Carapaça", "Pinças"]
};

test("as 27 linhagens têm padrões cadastrados e IDs resolvidos no catálogo", () => {
  assert.equal(LINHAGENS.length, 27);
  assert.equal(Object.keys(Object.fromEntries(LINHAGENS.map(x => [x.nome, true]))).length, 27);
  for (const linhagem of LINHAGENS) {
    const nomes = obterTracosComunsLinhagem(linhagem.nome);
    const ids = obterTracosPadraoLinhagem(linhagem.nome);
    assert.ok(nomes.length, `Sem traços comuns: ${linhagem.nome}`);
    assert.equal(ids.length, nomes.length, `ID inválido em ${linhagem.nome}`);
    assert.deepEqual(ids.map(id => CATALOGO_TRACOS.find(item => item.id === id)?.nome), nomes);
    assert.deepEqual(nomes, esperados[linhagem.nome], linhagem.nome);
  }
});

test("novas fichas recebem apenas o padrão da linhagem e podem sobrescrevê-lo explicitamente", () => {
  for (const linhagem of LINHAGENS) {
    const ficha = criarNativa({ id: "novo", name: "Teste", lineage: linhagem.nome, attrs: {}, techniques: [] });
    assert.deepEqual(ficha.tracos, obterTracosPadraoLinhagem(linhagem.nome), linhagem.nome);
  }
  const vaziaIntencionalmente = criarNativa({ id: "manual", name: "Manual", lineage: "Canídeos", attrs: {}, tracos: [] });
  assert.deepEqual(vaziaIntencionalmente.tracos, []);
});

test("alterar traços de uma ficha não altera os identificadores nem os registros do catálogo", () => {
  const idsOriginais = CATALOGO_TRACOS.map(item => item.id);
  const descricoesOriginais = CATALOGO_TRACOS.map(item => item.descricao);
  const ficha = criarNativa({ id: "editada", name: "Editada", lineage: "Felinos", attrs: {} });
  ficha.tracos.splice(0, ficha.tracos.length, obterTracosPadraoLinhagem("Crustáceos")[0]);
  assert.deepEqual(CATALOGO_TRACOS.map(item => item.id), idsOriginais);
  assert.deepEqual(CATALOGO_TRACOS.map(item => item.descricao), descricoesOriginais);
  assert.deepEqual(criarNativa({ id: "nova", name: "Nova", lineage: "Felinos", attrs: {} }).tracos, obterTracosPadraoLinhagem("Felinos"));
});

test("traços de consulta têm identificadores únicos e distinção entre veneno e peçonha", () => {
  assert.equal(new Set(CATALOGO_TRACOS.map(item => item.id)).size, CATALOGO_TRACOS.length);
  const peconha = CATALOGO_TRACOS.find(item => item.nome === "Peçonha");
  const veneno = CATALOGO_TRACOS.find(item => item.nome === "Veneno");
  assert.match(peconha.descricao, /inoculada por estrutura especializada/i);
  assert.match(veneno.descricao, /contato ou ingestão/i);
});

test("cada traço pode ser consultado individualmente por ID persistido", () => {
  for (const traco of CATALOGO_TRACOS) assert.equal(obterTracoPorId(traco.id), traco);
  const ficha = { tracos: [CATALOGO_TRACOS[0].id] };
  assert.equal(nativaPossuiTraco(ficha, CATALOGO_TRACOS[0].id), true);
  assert.equal(nativaPossuiTraco(ficha, CATALOGO_TRACOS[1].id), false);
  assert.equal(nativaPossuiTraco(ficha, "id-inexistente"), false);
  assert.equal(obterTracoPorId("id-inexistente"), null);
});

test("a migração preenche Traços ausentes pelo padrão da linhagem e preserva listas existentes", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /if \(!Array\.isArray\(n\.tracos\)\) n\.tracos = obterTracosPadraoLinhagem/);
  assert.match(app, /n\.tracosQuimericos \|\|= \[\]/);
});
