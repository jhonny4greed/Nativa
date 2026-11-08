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

test('28 especiais de combate têm parâmetros; utilitários e Jato ficam fora do balanceamento de dano', () => {
  const prontos=TECNICAS_LINHAGEM_V2_1.filter(t=>t.parametrosTecnicosDisponiveis);
  assert.equal(prontos.length,28);
  for(const t of prontos) {
    assert.equal(t.precisao,-1-t.P,t.id);
    assert.equal(t.recarga,t.R,t.id);
    assert.equal(t.mp,t.M,t.id);
    assert.ok(Number.isFinite(t.pg),t.id);
    assert.equal(t.dano,null,t.id);
    assert.ok(Number.isInteger(t.parametrosBalanceamento.pgLiquido),t.id);
    assert.equal(t.parametrosBalanceamento.pgLiquido,t.parametrosBalanceamento.pgBruto-t.parametrosBalanceamento.custoEfeitos,t.id);
  }
  for(const nome of ['Faro de Perseguição','Exploração Atenta','Ecolocalização','Chamado do Bando','Jato Defensivo']) {
    const t=TECNICAS_LINHAGEM_V2_1.find(x=>x.nome===nome);
    assert.ok(t);
    assert.equal(t.parametrosTecnicosDisponiveis,undefined);
    assert.equal(t.pg,null,t.id);
    assert.equal(t.dano,null,t.id);
    assert.equal(t.parametrosBalanceamento,undefined,t.id);
  }
});

test('regras comuns preservam durações e intensidades aprovadas', () => {
  assert.equal(REGRAS_EFEITOS_V2_1.desorientacao.acumula, false);
  assert.equal(REGRAS_EFEITOS_V2_1.reducao_atributo.acumula, false);
  assert.equal(REGRAS_EFEITOS_V2_1.reducao_atributo.renovaDuracao, true);
  assert.equal(REGRAS_EFEITOS_V2_1.reducao_dano.acumula, false);
  assert.equal(REGRAS_EFEITOS_V2_1.bonus_precisao.acumula, false);
  assert.equal(REGRAS_EFEITOS_V2_1.envenenamento.duracao, 2);
  assert.equal(REGRAS_EFEITOS_V2_1.envenenamento.dano, 1);
  assert.equal(REGRAS_EFEITOS_V2_1.digestao.duracao, 1);
  assert.equal(REGRAS_EFEITOS_V2_1.digestao.dano, 1);
  assert.equal(REGRAS_EFEITOS_V2_1.secrecao_defensiva.duracaoUsuario, 2);
  assert.equal(REGRAS_EFEITOS_V2_1.secrecao_defensiva.ativacoes, 1);
});

test('cada efeito anexado é isolado e o catálogo global segue imutável', () => {
  const golpe = TECNICAS_LINHAGEM_V2_1.find(t => t.nome === 'Rugido da Caçadora');
  assert.ok(Object.isFrozen(golpe.efeitosV2_1));
  assert.ok(Object.isFrozen(golpe.efeitosV2_1[0]));
  assert.throws(() => golpe.efeitosV2_1[0].id = 'alterado', TypeError);
});
