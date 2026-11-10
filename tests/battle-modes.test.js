import test from "node:test";
import assert from "node:assert/strict";
import { MODOS_BATALHA, escolherAcaoCpu } from "../js/battle-modes.js";
import { TECNICAS_ARQUIVADAS, TECNICAS } from "../js/techniques.js";
import { resolverTurnoCombate } from "../js/combat-domain.js";

const tecnicasValidas = TECNICAS_ARQUIVADAS.filter(item => item.compatibilidadeCombate === true && item.mp > 0 && Number.isFinite(item.recarga));

function combatente(tecnicas, { mp = 4, maxMP = 4, cooldowns = {} } = {}) {
  return {
    nativa: {
      id: "cpu-test", name: "Adversária",
      attrs: { ATQ: 2, POT: 2, DEF: 1, RES: 1, AGI: 1, HP: 2, MP: 2 },
      techniques: tecnicas.map(item => item.id), affinity: "Fogo", essencias: []
    },
    hp: 10, maxHP: 10, mp, maxMP, cooldowns
  };
}

test("modos iniciais são explicitamente CPU e multiplayer local", () => {
  assert.equal(MODOS_BATALHA.CPU, "cpu");
  assert.equal(MODOS_BATALHA.LOCAL, "local");
});

test("CPU escolhe aleatoriamente somente entre técnicas com MP e sem recarga", () => {
  const [recarga, semMp, disponivelA, disponivelB] = tecnicasValidas.slice(0, 4);
  const alvo = combatente([recarga, semMp, disponivelA, disponivelB], {
    mp: Math.max(disponivelA.mp, disponivelB.mp),
    cooldowns: { [recarga.id]: 2 }
  });
  const custos = [disponivelA.mp, disponivelB.mp];
  alvo.mp = Math.max(...custos);
  const escolha = escolherAcaoCpu(alvo, () => 0.99);
  assert.deepEqual(escolha, { tipo: "attack", tecnicaId: disponivelB.id });
});

test("CPU não escolhe técnica sem MP ou em recarga e usa ação especial existente", () => {
  const [tecnicaA, tecnicaB] = tecnicasValidas.slice(0, 2);
  const semOpcoes = combatente([tecnicaA, tecnicaB], {
    mp: 0,
    maxMP: 4,
    cooldowns: { [tecnicaA.id]: 1, [tecnicaB.id]: 1 }
  });
  assert.deepEqual(escolherAcaoCpu(semOpcoes), { tipo: "recover" });
  semOpcoes.mp = semOpcoes.maxMP;
  assert.deepEqual(escolherAcaoCpu(semOpcoes), { tipo: "defend" });
});

test("escolha da CPU passa pelo resolvedor normal e mantém o encerramento por PV zero", () => {
  const tecnica = tecnicasValidas.find(item => item.categoria === "Físico");
  const atacante = combatente([tecnica], { mp: tecnica.mp });
  const alvo = combatente([]);
  alvo.nativa.name = "Jogador";
  alvo.hp = 1;
  const escolha = escolherAcaoCpu(atacante, () => 0);
  const resultado = resolverTurnoCombate({
    fighters: [alvo, atacante],
    choices: [null, escolha],
    random: () => 0.99
  });
  assert.equal(resultado.error, null);
  assert.equal(resultado.ended, true);
  assert.equal(resultado.fighters[0].hp, 0);
  assert.ok(resultado.events.some(event => event.type === "defeat"));
});

test("CPU prioriza golpes V2.2.1 aprovados e mantém golpes legados aprendidos disponíveis",()=>{
  const aviso=TECNICAS_ARQUIVADAS.find(t=>t.id==='arquetipo-veloz-ataque-relampago');
  const peconha=TECNICAS.find(t=>t.nome==='Peçonha Concentrada');
  const cpu=combatente([aviso,peconha],{mp:8,maxMP:8});
  const alvo=combatente([]);
  assert.equal(escolherAcaoCpu(cpu,()=>0,alvo).tecnicaId,peconha.id);
  alvo.efeitosV21=[{tipo:'envenenamento',danoPorTurno:1,turnosRestantes:2,intensificado:false}];
  assert.equal(escolherAcaoCpu(cpu,()=>0.99,alvo).tecnicaId,peconha.id);
});
