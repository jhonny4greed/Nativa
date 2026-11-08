import test from 'node:test';
import assert from 'node:assert/strict';
import { TECNICAS_LINHAGEM_V2_1 } from '../js/techniques-v2-1.js';
import { EFEITOS_CONCEITUAIS_POR_TECNICA_V2_1, REGRAS_EFEITOS_V2_1 } from '../js/technique-effects-v2-1.js';

test('efeitos conceituais apontam para técnicas existentes sem alterar seus IDs', () => {
  const ids = new Set(TECNICAS_LINHAGEM_V2_1.map(t => t.id));
  assert.equal(Object.keys(EFEITOS_CONCEITUAIS_POR_TECNICA_V2_1).length, 32);
  for (const id of Object.keys(EFEITOS_CONCEITUAIS_POR_TECNICA_V2_1)) assert.ok(ids.has(id), `ID ausente: ${id}`);
  assert.equal(TECNICAS_LINHAGEM_V2_1.length, 108);
});

test('Jato Defensivo permanece sem implementação conceitual até confirmação biológica', () => {
  const jato = TECNICAS_LINHAGEM_V2_1.find(t => t.nome === 'Jato Defensivo');
  assert.ok(jato);
  assert.equal(Object.hasOwn(EFEITOS_CONCEITUAIS_POR_TECNICA_V2_1, jato.id), false);
  assert.equal(jato.efeitosV2_1, undefined);
  assert.match(jato.efeito, /espécie|substância|afastar/i);
});

test('parâmetros numéricos dos golpes especiais e suporte seguem pendentes', () => {
  for (const t of TECNICAS_LINHAGEM_V2_1.filter(x => x.categoria !== 'Físico')) {
    assert.equal(t.precisao, null, t.id);
    assert.equal(t.mp, null, t.id);
    assert.equal(t.recarga, null, t.id);
    assert.equal(t.pg, null, t.id);
    assert.equal(t.dano, null, t.id);
  }
});

test('regras comuns preservam durações e limites aprovados sem inventar intensidades', () => {
  assert.equal(REGRAS_EFEITOS_V2_1.desorientacao.acumula, false);
  assert.equal(REGRAS_EFEITOS_V2_1.reducao_atributo.acumula, false);
  assert.equal(REGRAS_EFEITOS_V2_1.reducao_atributo.renovaDuracao, true);
  assert.equal(REGRAS_EFEITOS_V2_1.reducao_dano.acumula, false);
  assert.equal(REGRAS_EFEITOS_V2_1.bonus_precisao.acumula, false);
  assert.equal(REGRAS_EFEITOS_V2_1.envenenamento.duracao, 2);
  assert.equal(REGRAS_EFEITOS_V2_1.envenenamento.dano, null);
  assert.equal(REGRAS_EFEITOS_V2_1.digestao.duracao, 1);
  assert.equal(REGRAS_EFEITOS_V2_1.digestao.dano, null);
  assert.equal(REGRAS_EFEITOS_V2_1.secrecao_defensiva.duracaoUsuario, 2);
  assert.equal(REGRAS_EFEITOS_V2_1.secrecao_defensiva.ativacoes, 1);
});

test('cada efeito anexado é isolado e o catálogo global segue imutável', () => {
  const golpe = TECNICAS_LINHAGEM_V2_1.find(t => t.nome === 'Rugido da Caçadora');
  assert.ok(Object.isFrozen(golpe.efeitosV2_1));
  assert.ok(Object.isFrozen(golpe.efeitosV2_1[0]));
  assert.throws(() => golpe.efeitosV2_1[0].id = 'alterado', TypeError);
});
