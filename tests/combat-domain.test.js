import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { readFileSync } from "node:fs";
import { TECNICAS, TECNICAS_V1_ARQUIVO, TECNICAS_ARQUETIPO_LEGADO, obterTecnicaPorId } from "../js/techniques.js";
import {
  criarCombatente,
  modificadorAfinidade,
  danoNumerico,
  avancarCombatentesDeTurno,
  resolverTurnoCombate
} from "../js/combat-domain.js";
import { CATALOGO_TRACOS } from "../js/traits.js";
import { MODIFICADORES_TECNICA_ARENA, obterModificadorTecnicaArena } from "../js/arena-technique-modifiers.js";

const tecnica = nome => {
  const resultado = [...TECNICAS_V1_ARQUIVO, ...TECNICAS_ARQUETIPO_LEGADO, ...TECNICAS].find(item => item.nome === nome);
  assert.ok(resultado, `Técnica de caracterização ausente: ${nome}`);
  return resultado;
};

function nativa(id, name, overrides = {}) {
  return {
    id, name, attrs: { ATQ: 3, POT: 4, DEF: 2, RES: 2, AGI: 3, HP: 2, MP: 3 },
    affinity: "Fogo", techniques: [], essencias: [], afinidadesEssencia: [], ...overrides
  };
}

function dadosAleatorios(rolls) {
  let index = 0;
  const random = () => {
    assert.ok(index < rolls.length, "O resolvedor consumiu mais dados do que o baseline.");
    return (rolls[index++] - 1) / 10;
  };
  random.consumed = () => index;
  return random;
}

test("Pinça Esmagadora recebe sinergia de Pinças do usuário sem tornar o golpe dependente do traço", () => {
  const pinça = tecnica("Pinça Esmagadora");
  const idPinças = CATALOGO_TRACOS.find(x => x.nome === "Pinças").id;
  const atacanteCom = criarCombatente(nativa("a", "Caranguejo", { techniques: [pinça.id], tracos: [idPinças], attrs: { ATQ: 3, DEF: 2, AGI: 10, HP: 3, MP: 3 } }));
  const atacanteSem = criarCombatente(nativa("c", "Outra Nativa", { techniques: [pinça.id], attrs: { ATQ: 3, DEF: 2, AGI: 10, HP: 3, MP: 3 } }));
  const alvo = criarCombatente(nativa("b", "Alvo", { attrs: { ATQ: 1, DEF: 2, AGI: 1, HP: 5, MP: 2 } }));
  const com = resolverTurnoCombate({ fighters: [atacanteCom, alvo], choices: [{ tipo: "attack", tecnicaId: pinça.id }, null], random: dadosAleatorios([10, 1, 10]) });
  const sem = resolverTurnoCombate({ fighters: [atacanteSem, alvo], choices: [{ tipo: "attack", tecnicaId: pinça.id }, null], random: dadosAleatorios([10, 1, 10]) });
  assert.equal(com.events.find(e => e.type === "hit").damage, sem.events.find(e => e.type === "hit").damage + 1);
  assert.equal(com.events.find(e => e.type === "hit").sinergias.length, 1);
  assert.equal(sem.events.find(e => e.type === "hit").sinergias.length, 0);
});

test("golpe aprendido por essência continua utilizável sem o traço correspondente", () => {
  const golpe = tecnica("Pinça de Ruptura");
  const combatente = criarCombatente(nativa("a", "Nativa", { techniques: [golpe.id], attrs: { ATQ: 3, DEF: 2, AGI: 10, HP: 3, MP: 3 } }));
  const alvo = criarCombatente(nativa("b", "Alvo", { attrs: { ATQ: 1, DEF: 2, AGI: 1, HP: 5, MP: 2 } }));
  const result = resolverTurnoCombate({ fighters: [combatente, alvo], choices: [{ tipo: "attack", tecnicaId: golpe.id }, null], random: dadosAleatorios([10, 1, 10]) });
  assert.equal(result.error, null);
  assert.ok(result.events.some(e => e.type === "hit"));
  assert.equal(result.events.find(e => e.type === "hit").bonusDano, 0);
});

// Referência de caracterização, copiada do resolvedor que estava em app.js
// antes da extração. Os cenários abaixo comparam os dois algoritmos nas mesmas entradas.
function legacyResolve(fightersInput, choices, random) {
  const fighters = structuredClone(fightersInput);
  const log = [];
  const rolls = fighters.map(c => ({ roll: Math.floor(random() * 10) + 1, agi: c.nativa.attrs.AGI || 1 }));
  fighters.forEach((c, i) => { c.initiative = rolls[i].roll + rolls[i].agi; });
  const order = fighters[0].initiative >= fighters[1].initiative ? [0, 1] : [1, 0];
  log.push(`🎲 Iniciativa: ${fighters[0].nativa.name} ${rolls[0].roll}+${rolls[0].agi}=${fighters[0].initiative}; ${fighters[1].nativa.name} ${rolls[1].roll}+${rolls[1].agi}=${fighters[1].initiative}. Ordem: ${order.map(i => fighters[i].nativa.name).join(" → ")}.`);

  for (const index of order) {
    const c = fighters[index];
    const target = fighters[1 - index];
    if (c.hp <= 0 || target.hp <= 0) continue;
    const choice = choices[index];
    if (choice?.tipo === "attack") {
      const t = (c.nativa.techniques || []).map(id => obterTecnicaPorId(id)).filter(Boolean).find(x => x.id === choice.tecnicaId);
      if (!t) throw new Error("Técnica não encontrada na ficha.");
      if (c.cooldowns[t.id] > 0) throw new Error(`${t.nome} está em recarga.`);
      if (c.mp < t.mp) throw new Error(`${c.nativa.name} não tem MP suficiente.`);
      c.mp -= t.mp;
      c.animacao = "attack";
      if (t.recarga > 0) c.cooldowns[t.id] = t.recarga + 1;
      if (t.categoria === "Suporte") {
        log.push(`✨ ${c.nativa.name} usa ${t.nome}. Efeito: ${t.efeito} (efeito registrado para aplicação na mesa).`);
        c.animacao = "recover";
      } else {
        const roll = Math.floor(random() * 10) + 1;
        const penalty = Math.abs(Number(t.precisao) || 0);
        if (t.precisao !== null && roll <= penalty) {
          log.push(`💨 ${c.nativa.name} tenta usar ${t.nome}, mas erra! D10: ${roll}. Precisava superar ${penalty}.`);
          c.animacao = "miss";
        } else {
          const physical = t.categoria === "Físico";
          const offense = physical ? (c.nativa.attrs.ATQ || 1) : (c.nativa.attrs.POT || 1);
          const defense = physical ? (target.nativa.attrs.DEF || 1) : (target.nativa.attrs.RES || 1);
          const techniqueDamage = t.dano === null || t.dano === undefined ? 0 : typeof t.dano === "number" ? t.dano : String(t.dano).split("+").reduce((sum, part) => sum + (Number(part) || 0), 0);
          const base = Math.max(1, offense + techniqueDamage - defense);
          let modifier = 0;
          if (t.origem === "afinidade") {
            const defenses = [target.nativa.affinity, ...((target.nativa.essencias || []).includes("segunda") ? [target.nativa.afinidadesEssencia?.[1]].filter(Boolean) : [])];
            let weak = false; let resistant = false;
            const relations = { Fogo: { fraco: "Água", resiste: "Vento" }, Vento: { fraco: "Fogo", resiste: "Terra" }, Terra: { fraco: "Vento", resiste: "Energia" }, Energia: { fraco: "Terra", resiste: "Água" }, Água: { fraco: "Energia", resiste: "Fogo" } };
            for (const affinity of defenses) { const rel = relations[affinity]; if (!rel) continue; if (rel.fraco === t.grupo) weak = true; if (rel.resiste === t.grupo) resistant = true; }
            if (!(weak && resistant)) modifier = weak ? 2 : resistant ? -2 : 0;
          }
          const damage = Math.max(0, base + modifier);
          target.hp = Math.max(0, target.hp - damage);
          target.animacao = "hit";
          log.push(`⚔️ ${c.nativa.name} usa ${t.nome}! D10: ${roll}. Dano: ${offense} + ${techniqueDamage} − ${defense} = ${base}${modifier ? ` (${modifier > 0 ? "+" : ""}${modifier} afinidade)` : ""}. ${target.nativa.name} recebe ${damage} de dano.`);
        }
      }
    }
    if (choice?.tipo === "defend") {
      c.animacao = "defend";
      log.push(`🛡️ ${c.nativa.name} assume uma postura defensiva e passa seu turno.`);
    }
    if (choice?.tipo === "recover") {
      const before = c.mp;
      c.mp = Math.min(c.maxMP, c.mp + 1);
      const recovered = c.mp - before;
      c.animacao = "recover";
      log.push(recovered > 0
        ? `🔷 ${c.nativa.name} concentra suas energias e recupera 1 MP. MP atual: ${c.mp}/${c.maxMP}.`
        : `🔷 ${c.nativa.name} tentou recuperar MP, mas já estava com a energia máxima (${c.maxMP} MP).`);
    }
    if (target.hp <= 0) break;
  }

  const defeated = fighters.find(c => c.hp <= 0);
  if (defeated) {
    log.push(`🏆 ${defeated.nativa.name} foi derrotada!`);
    log.push(`Vitória de ${fighters.find(c => c.hp > 0)?.nativa.name || "ninguém"}.`);
  }
  return { fighters, rolls, order, log, ended: Boolean(defeated) };
}

function formatarEventos(events) {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const source = app.match(/function apresentarEventosCombate\(eventos\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(source, "Formatador do app não encontrado.");
  const context = { batalha: { log: [] }, eventos: events };
  runInNewContext(`(${source})(eventos)`, context);
  return context.batalha.log;
}
function executarComparacao({ combatentes, escolhas, dados }) {
  const oldRandom = dadosAleatorios(dados);
  const newRandom = dadosAleatorios(dados);
  const legacy = legacyResolve(combatentes, escolhas, oldRandom);
  const current = resolverTurnoCombate({ fighters: combatentes, choices: escolhas, random: newRandom });
  assert.deepEqual(current.fighters, legacy.fighters);
  assert.deepEqual(current.rolls, legacy.rolls);
  assert.deepEqual(current.order, legacy.order);
  assert.equal(current.ended, legacy.ended);
  assert.deepEqual(formatarEventos(current.events), legacy.log);
  assert.equal(newRandom.consumed(), oldRandom.consumed());
  return current;
}

test("criação do combatente mantém HP, MP, cooldowns e referência à ficha", () => {
  const n = nativa("fighter", "Jatobá");
  const combatente = criarCombatente(n);
  assert.equal(combatente.nativa, n);
  assert.deepEqual(combatente, { nativa: n, hp: 10, mp: 6, cooldowns: {}, maxHP: 10, maxMP: 6, animacao: "" });
});

test("integração de bioma da arena aceita ausência de configuração sem alterar o resultado", () => {
  const golpe = tecnica("Mordida Persistente");
  const ficha = nativa("a", "Aruã", { bioma: "Floresta e Mata", techniques: [golpe.id] });
  const fighters = [criarCombatente(ficha), criarCombatente(nativa("b", "Bento"))];
  const choices = [{ tipo: "attack", tecnicaId: golpe.id }, { tipo: "defend" }];
  const baseline = resolverTurnoCombate({ fighters, choices, random: dadosAleatorios([4, 3, 7]) });
  const arena = resolverTurnoCombate({ fighters, choices, biomaArena: "Costa, Restinga e Manguezal", random: dadosAleatorios([4, 3, 7]) });
  assert.deepEqual(arena, baseline);
  assert.equal(obterModificadorTecnicaArena(golpe.id, "Costa, Restinga e Manguezal"), null);
  assert.equal(MODIFICADORES_TECNICA_ARENA[golpe.id], undefined);
  assert.equal(fighters[0].nativa.bioma, "Floresta e Mata");
  assert.notEqual("Costa, Restinga e Manguezal", fighters[0].nativa.bioma);
});

test("ataque físico: dano, custo, recarga, iniciativa e log equivalem ao resolvedor anterior", () => {
  const mordida = tecnica("Mordida Persistente");
  const fighters = [criarCombatente(nativa("a", "Aruã", { techniques: [mordida.id] })), criarCombatente(nativa("b", "Bento"))];
  const before = structuredClone(fighters);
  const result = executarComparacao({ combatentes: fighters, escolhas: { 0: { tipo: "attack", tecnicaId: mordida.id }, 1: { tipo: "defend" } }, dados: [4, 3, 7] });
  assert.deepEqual(fighters, before, "resolverTurnoCombate não deve mutar as entradas");
  assert.equal(result.fighters[0].mp, 5);
  assert.equal(result.fighters[0].cooldowns[mordida.id], 3);
  assert.equal(result.fighters[1].hp, 6);
  assert.equal(result.events.some(event => event.type === "hit"), true);
});

test("erro de precisão ocorre no limite exato e não aplica dano", () => {
  const mordida = tecnica("Mordida Persistente");
  const fighters = [criarCombatente(nativa("a", "Aruã", { techniques: [mordida.id] })), criarCombatente(nativa("b", "Bento"))];
  const result = executarComparacao({ combatentes: fighters, escolhas: { 0: { tipo: "attack", tecnicaId: mordida.id }, 1: { tipo: "defend" } }, dados: [4, 3, 2] });
  assert.equal(result.fighters[1].hp, 10);
  assert.equal(result.events.find(event => event.type === "miss").threshold, 2);
});

test("ataque especial usa POT contra RES e mantém a mesma rolagem e resultado", () => {
  const jato = tecnica("Jato de Labaredas");
  const fighters = [criarCombatente(nativa("a", "Aruã", { techniques: [jato.id] })), criarCombatente(nativa("b", "Bento"))];
  const result = executarComparacao({ combatentes: fighters, escolhas: { 0: { tipo: "attack", tecnicaId: jato.id }, 1: { tipo: "defend" } }, dados: [4, 3, 7] });
  const hit = result.events.find(event => event.type === "hit");
  assert.equal(hit.offensive, 4);
  assert.equal(hit.defense, 2);
  assert.equal(result.fighters[0].mp, 4);
});

test("afinidade aplica vulnerabilidade, resistência e cancelamento com terceira afinidade", () => {
  const jatoAgua = tecnica("Jato Direto");
  const attacker = criarCombatente(nativa("a", "Aruã", { affinity: "Água", techniques: [jatoAgua.id] }));
  const fraco = criarCombatente(nativa("b", "Fogo", { affinity: "Fogo" }));
  const resiste = criarCombatente(nativa("c", "Energia", { affinity: "Energia" }));
  const cancela = criarCombatente(nativa("d", "Misto", { affinity: "Fogo", essencias: ["segunda"], afinidadesEssencia: ["Vento", "Energia"] }));
  assert.equal(modificadorAfinidade(attacker, fraco, jatoAgua), 2);
  assert.equal(modificadorAfinidade(attacker, resiste, jatoAgua), -2);
  assert.equal(modificadorAfinidade(attacker, cancela, jatoAgua), 0);
  const fighters = [attacker, fraco];
  const result = executarComparacao({ combatentes: fighters, escolhas: { 0: { tipo: "attack", tecnicaId: jatoAgua.id }, 1: { tipo: "defend" } }, dados: [4, 3, 7] });
  assert.equal(result.events.find(event => event.type === "hit").affinityModifier, 2);
});

test("técnica de suporte não rola acerto nem aplica o efeito descrito", () => {
  const suporte = tecnica("Muralha Súbita");
  const fighters = [criarCombatente(nativa("a", "Aruã", { affinity: "Terra", techniques: [suporte.id] })), criarCombatente(nativa("b", "Bento"))];
  const result = executarComparacao({ combatentes: fighters, escolhas: { 0: { tipo: "attack", tecnicaId: suporte.id }, 1: { tipo: "defend" } }, dados: [4, 3] });
  assert.equal(result.fighters[0].mp, 4);
  assert.equal(result.fighters[1].hp, 10);
  assert.equal(result.events.some(event => event.type === "support"), true);
});

test("defender e recuperar MP mantêm o comportamento, inclusive MP cheio", () => {
  const fighters = [criarCombatente(nativa("a", "Aruã")), criarCombatente(nativa("b", "Bento"))];
  fighters[0].mp = 5;
  const result = executarComparacao({ combatentes: fighters, escolhas: { 0: { tipo: "recover" }, 1: { tipo: "defend" } }, dados: [4, 3] });
  assert.equal(result.fighters[0].mp, 6);
  assert.equal(result.events.find(event => event.type === "recover").recovered, 1);
  const full = executarComparacao({ combatentes: result.fighters, escolhas: { 0: { tipo: "recover" }, 1: { tipo: "defend" } }, dados: [4, 3] });
  assert.equal(full.fighters[0].mp, 6);
  assert.equal(full.events.find(event => event.type === "recover").recovered, 0);
});

test("iniciativa empatada mantém fighter 0 primeiro e elimina a segunda ação após nocaute", () => {
  const golpe = tecnica("Mordida Persistente");
  const fighters = [criarCombatente(nativa("a", "Aruã", { attrs: { ATQ: 30, POT: 4, DEF: 2, RES: 2, AGI: 3, HP: 2, MP: 3 }, techniques: [golpe.id] })), criarCombatente(nativa("b", "Bento", { techniques: [golpe.id] }))];
  fighters[1].hp = 1;
  const result = executarComparacao({ combatentes: fighters, escolhas: { 0: { tipo: "attack", tecnicaId: golpe.id }, 1: { tipo: "attack", tecnicaId: golpe.id } }, dados: [5, 5, 5] });
  assert.deepEqual(result.order, [0, 1]);
  assert.equal(result.ended, true);
  assert.equal(result.fighters[1].mp, 6);
  assert.deepEqual(result.events.filter(event => event.type === "hit").map(event => event.attacker), ["Aruã"]);
});

test("recarga e animação avançam no início de turno como antes", () => {
  const fighters = [criarCombatente(nativa("a", "Aruã")), criarCombatente(nativa("b", "Bento"))];
  fighters[0].cooldowns = { x: 1, y: 3, z: 0 };
  fighters[0].animacao = "hit";
  const next = avancarCombatentesDeTurno(fighters);
  assert.deepEqual(next[0].cooldowns, { y: 2 });
  assert.equal(next[0].animacao, "");
  assert.deepEqual(fighters[0].cooldowns, { x: 1, y: 3, z: 0 });
});

test("danos compostos e limites inferiores reproduzem os cálculos atuais", () => {
  assert.equal(danoNumerico("2+2"), 4);
  assert.equal(danoNumerico(null), 0);
  const golpe = tecnica("Jato de Labaredas");
  const fighters = [criarCombatente(nativa("a", "Aruã", { attrs: { ATQ: 1, POT: 1, DEF: 1, RES: 1, AGI: 1, HP: 1, MP: 1 }, techniques: [golpe.id] })), criarCombatente(nativa("b", "Bento", { attrs: { ATQ: 1, POT: 1, DEF: 1, RES: 20, AGI: 1, HP: 1, MP: 1 } }))];
  const result = executarComparacao({ combatentes: fighters, escolhas: { 0: { tipo: "attack", tecnicaId: golpe.id }, 1: { tipo: "defend" } }, dados: [2, 1, 10] });
  assert.equal(result.events.find(event => event.type === "hit").baseDamage, 1);
  assert.equal(result.fighters[1].hp, 4);
});

test("técnica de dano composto continua sendo um único ataque e consome uma rolagem", () => {
  const sequencia = tecnica("Sequência Rápida");
  const fighters = [criarCombatente(nativa("a", "Aruã", { archetype: "Veloz", techniques: [sequencia.id] })), criarCombatente(nativa("b", "Bento"))];
  const random = dadosAleatorios([5, 4, 8]);
  const result = resolverTurnoCombate({ fighters, choices: { 0: { tipo: "attack", tecnicaId: sequencia.id }, 1: { tipo: "defend" } }, random });
  assert.equal(random.consumed(), 3);
  assert.equal(result.events.filter(event => event.type === "hit").length, 1);
  assert.equal(result.events.find(event => event.type === "hit").techniqueDamage, 4);
});

test("erro de técnica preserva o estado parcial e a mensagem do fluxo legado", () => {
  const golpe = tecnica("Mordida Persistente");
  const fighters = [criarCombatente(nativa("a", "Aruã", { techniques: [golpe.id] })), criarCombatente(nativa("b", "Bento"))];
  fighters[0].mp = 0;
  const result = resolverTurnoCombate({
    fighters,
    choices: { 0: { tipo: "attack", tecnicaId: golpe.id }, 1: { tipo: "defend" } },
    random: dadosAleatorios([5, 4])
  });
  assert.equal(result.error.message, "Aruã não tem MP suficiente.");
  assert.equal(result.fighters[0].mp, 0);
  assert.deepEqual(result.events.map(event => event.type), ["initiative"]);
  assert.equal(result.ended, false);
});

test("efeitos descritos como sangramento/penalidades permanecem somente descritivos no combate atual", () => {
  const mordida = tecnica("Mordida Persistente");
  const fighters = [criarCombatente(nativa("a", "Aruã", { techniques: [mordida.id] })), criarCombatente(nativa("b", "Bento"))];
  const first = executarComparacao({ combatentes: fighters, escolhas: { 0: { tipo: "attack", tecnicaId: mordida.id }, 1: { tipo: "defend" } }, dados: [4, 3, 7] });
  const hpDepoisDoAcerto = first.fighters[1].hp;
  const next = avancarCombatentesDeTurno(first.fighters);
  assert.equal(next[1].hp, hpDepoisDoAcerto);
  assert.equal(next[1].nativa.attrs.ATQ, 3);
  assert.equal(next[1].nativa.attrs.DEF, 2);
});

test("dados das fichas de entrada não são modificados por resolução ou passagem de turno", () => {
  const golpe = tecnica("Mordida Persistente");
  const a = nativa("a", "Aruã", { techniques: [golpe.id] });
  const b = nativa("b", "Bento");
  const originals = structuredClone([a, b]);
  const fighters = [criarCombatente(a), criarCombatente(b)];
  executarComparacao({ combatentes: fighters, escolhas: { 0: { tipo: "attack", tecnicaId: golpe.id }, 1: { tipo: "recover" } }, dados: [3, 4, 9] });
  avancarCombatentesDeTurno(fighters);
  assert.deepEqual([a, b], originals);
});

test("camada visual preserva os textos do histórico e o temporizador permanece em app.js", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /setTimeout\(\(\)=>\{[\s\S]*?prepararTurno\(false\)/);
  assert.match(app, /Iniciativa:/);
  assert.match(app, /efeito registrado para aplicação na mesa/);
  assert.match(app, /Precisava superar/);
  assert.match(app, /foi derrotada!/);
});
