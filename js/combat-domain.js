import { obterTecnicaPorId } from "./techniques.js";
import { nativaPossuiTraco, obterTracoPorId } from "./traits.js";
import { obterModificadorTecnicaArena } from "./arena-technique-modifiers.js";
import { podeUsarTecnicaEmCombate } from "./technique-learning.js";

const RELACOES = {
  Fogo: { fraco: "Água", resiste: "Vento" },
  Vento: { fraco: "Fogo", resiste: "Terra" },
  Terra: { fraco: "Vento", resiste: "Energia" },
  Energia: { fraco: "Terra", resiste: "Água" },
  Água: { fraco: "Energia", resiste: "Fogo" }
};

export function criarCombatente(nativa) {
  return {
    nativa,
    hp: (nativa.attrs.HP || 1) * 5,
    mp: (nativa.attrs.MP || 1) * 2,
    cooldowns: {},
    maxHP: (nativa.attrs.HP || 1) * 5,
    maxMP: (nativa.attrs.MP || 1) * 2,
    animacao: ""
  };
}

export function obterTecnicasCombatente(combatente) {
  return (combatente.nativa.techniques || [])
    .map(id => obterTecnicaPorId(id))
    .filter(Boolean);
}

export function modificadorAfinidade(atacante, defensor, tecnica) {
  if (tecnica.origem !== "afinidade") return 0;

  const ataque = tecnica.grupo;
  const defesas = [
    defensor.nativa.affinity,
    ...((defensor.nativa.essencias || []).includes("segunda")
      ? [defensor.nativa.afinidadesEssencia?.[1]].filter(Boolean)
      : [])
  ];

  let fraco = false;
  let resiste = false;
  for (const afinidade of defesas) {
    const relacao = RELACOES[afinidade];
    if (!relacao) continue;
    if (relacao.fraco === ataque) fraco = true;
    if (relacao.resiste === ataque) resiste = true;
  }

  if (fraco && resiste) return 0;
  return fraco ? 2 : resiste ? -2 : 0;
}

export function danoNumerico(valor) {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return valor;
  return String(valor).split("+").reduce((soma, parte) => soma + (Number(parte) || 0), 0);
}

function clonarCombatente(combatente) {
  return { ...combatente, cooldowns: { ...(combatente.cooldowns || {}) },
    ...(combatente.efeitosV21 ? {efeitosV21:combatente.efeitosV21.map(efeito=>({...efeito}))} : {}) };
}

const EFEITOS_PREPARATORIOS_V21 = new Set([
  'linhagem-v2-1-mustelideos-secrecao-defensiva','linhagem-v2-1-roedores-alerta-da-colonia',
  'linhagem-v2-1-marsupiais-falsa-morte','linhagem-v2-1-marsupiais-secrecao-repulsiva',
  'linhagem-v2-1-morcegos-voo-erratico','linhagem-v2-1-aves-de-rapina-grito-de-rapina',
  'linhagem-v2-1-aves-corredoras-e-campestres-chamado-de-advertencia',
  'linhagem-v2-1-quelonios-vocalizacao-de-defesa','linhagem-v2-1-anuros-secrecao-defensiva',
  'linhagem-v2-1-peixes-cartilaginosos-percepcao-do-tubarao-martelo'
]);
const TECNICAS_DANO_DIRETO_V21 = new Set([
  'linhagem-v2-1-morcegos-pulso-ultrassonico','linhagem-v2-1-xenartros-lingua-capturadora',
  'linhagem-v2-1-serpentes-bote-de-jararaca','linhagem-v2-1-peixes-eletricos-descarga-do-poraque',
  'linhagem-v2-1-peixes-eletricos-pulso-de-alta-voltagem','linhagem-v2-1-aracnideos-picada-venenosa',
  'linhagem-v2-1-insetos-sociais-acido-defensivo','linhagem-v2-1-insetos-predadores-enzimas-digestivas'
]);

function guardarEfeito(combatente, efeito) {
  combatente.turnoV21= combatente.turnoV21 || 0;
  const efeitos=combatente.efeitosV21||(combatente.efeitosV21=[]);
  const indice=efeitos.findIndex(atual=>atual.tipo===efeito.tipo);
  if(indice>=0) efeitos.splice(indice,1);
  efeitos.push(efeito);
}

function obterEfeito(combatente,tipo) { return (combatente.efeitosV21||[]).find(efeito=>efeito.tipo===tipo)||null; }

function consumirEfeito(combatente,tipo) {
  const efeitos=combatente.efeitosV21||[];
  const indice=efeitos.findIndex(efeito=>efeito.tipo===tipo);
  if(indice<0)return null;
  return efeitos.splice(indice,1)[0];
}

function atributoEfetivo(combatente,atributo) {
  const valor=Number(combatente.nativa.attrs[atributo]);
  const base=Number.isFinite(valor)&&valor!==0?valor:1;
  const reducao=obterEfeito(combatente,`reducao-${atributo.toLowerCase()}`)?.valor||0;
  return Math.max(0,base-reducao);
}

function registrarLogV21(eventos,mensagem) { eventos.push({type:'v21-log',message:mensagem}); }

function aplicarDesorientacao(alvo,eventos,origem,turnosAteExpirar=1) {
  guardarEfeito(alvo,{tipo:'desorientacao',valor:1,expiraEmTurno:(alvo.turnoV21||0)+turnosAteExpirar,origem});
  registrarLogV21(eventos,`${alvo.nativa.name} fica Desorientada: -1 de precisão no próximo golpe ofensivo.`);
}

function aplicarReducaoAtributo(alvo,atributo,origem,eventos,turnosAteExpirar=1) {
  guardarEfeito(alvo,{tipo:`reducao-${atributo.toLowerCase()}`,valor:1,expiraEmTurno:(alvo.turnoV21||0)+turnosAteExpirar,origem});
  registrarLogV21(eventos,`${alvo.nativa.name} sofre -1 ${atributo} até o fim do próximo turno.`);
}

function aplicarEfeitosAcertoV21(atacante,alvo,tecnica,eventos) {
  const id=tecnica.id;
  if(['linhagem-v2-1-felinos-rugido-da-cacadora','linhagem-v2-1-primatas-grito-de-alerta','linhagem-v2-1-ungulados-brado-territorial','linhagem-v2-1-lagartos-ameaca-visual','linhagem-v2-1-characiformes-descarga-de-muco','linhagem-v2-1-aracnideos-pelos-urticantes','linhagem-v2-1-morcegos-pulso-ultrassonico','linhagem-v2-1-peixes-eletricos-pulso-de-alta-voltagem','linhagem-v2-1-psitacideos-vocalizacao-imitativa'].includes(id)) aplicarDesorientacao(alvo,eventos,tecnica.nome);
  if(['linhagem-v2-1-xenartros-lingua-capturadora'].includes(id)) aplicarReducaoAtributo(alvo,'AGI',tecnica.nome,eventos);
  if(['linhagem-v2-1-anuros-vocalizacao-intimidante','linhagem-v2-1-peixes-eletricos-descarga-do-poraque','linhagem-v2-1-insetos-sociais-acido-defensivo'].includes(id)) aplicarReducaoAtributo(alvo,'ATQ',tecnica.nome,eventos);
  if(['linhagem-v2-1-serpentes-bote-de-jararaca','linhagem-v2-1-aracnideos-picada-venenosa'].includes(id)) {
    const anterior=obterEfeito(alvo,'envenenamento');
    guardarEfeito(alvo,{tipo:'envenenamento',danoPorTurno:anterior?.danoPorTurno||1,turnosRestantes:2,intensificado:anterior?.intensificado||false,origem:tecnica.nome});
    registrarLogV21(eventos,`${alvo.nativa.name} foi envenenada: 1 dano ao fim de cada um dos próximos 2 turnos.`);
  }
  if(id==='linhagem-v2-1-insetos-predadores-enzimas-digestivas') {
    guardarEfeito(alvo,{tipo:'digestao',dano:1,turnosRestantes:1,origem:tecnica.nome});
    registrarLogV21(eventos,`${alvo.nativa.name} recebeu Digestão: 1 dano adicional ao fim do próximo turno.`);
  }
}

function aplicarPreparacaoV21(combatente,tecnica,eventos) {
  combatente.turnoV21=combatente.turnoV21||0;
  const id=tecnica.id;
  if(id==='linhagem-v2-1-roedores-alerta-da-colonia') {
    guardarEfeito(combatente,{tipo:'bonus-iniciativa',valor:1});
    registrarLogV21(eventos,`${combatente.nativa.name} recebe +1 na próxima iniciativa.`);
  } else if(id==='linhagem-v2-1-aves-corredoras-e-campestres-chamado-de-advertencia'||id==='linhagem-v2-1-peixes-cartilaginosos-percepcao-do-tubarao-martelo') {
    guardarEfeito(combatente,{tipo:'bonus-precisao',valor:1,expiraEmTurno:combatente.turnoV21+2});
    registrarLogV21(eventos,`${combatente.nativa.name} recebe +1 de precisão no próximo golpe ofensivo.`);
  } else if(id==='linhagem-v2-1-mustelideos-secrecao-defensiva') {
    guardarEfeito(combatente,{tipo:'secrecao',consequencia:'reducao-atq',expiraEmTurno:combatente.turnoV21+2,origem:tecnica.nome});
    registrarLogV21(eventos,`${combatente.nativa.name} prepara secreção defensiva por até 2 turnos próprios.`);
  } else if(id==='linhagem-v2-1-marsupiais-secrecao-repulsiva') {
    guardarEfeito(combatente,{tipo:'secrecao',consequencia:'desorientacao',expiraEmTurno:combatente.turnoV21+2,origem:tecnica.nome});
    registrarLogV21(eventos,`${combatente.nativa.name} prepara secreção repulsiva por até 2 turnos próprios.`);
  } else if(id==='linhagem-v2-1-anuros-secrecao-defensiva') {
    guardarEfeito(combatente,{tipo:'secrecao',consequencia:'dano-especial',expiraEmTurno:combatente.turnoV21+2,origem:tecnica.nome});
    registrarLogV21(eventos,`${combatente.nativa.name} prepara secreção defensiva por até 2 turnos próprios.`);
  } else if(id==='linhagem-v2-1-marsupiais-falsa-morte') {
    guardarEfeito(combatente,{tipo:'reducao-dano',categoria:'geral',valor:2,expiraEmTurno:combatente.turnoV21+2});
    registrarLogV21(eventos,`${combatente.nativa.name} reduz em 2 o próximo dano recebido.`);
  } else if(id==='linhagem-v2-1-morcegos-voo-erratico') {
    guardarEfeito(combatente,{tipo:'reducao-dano',categoria:'fisico',valor:2,expiraEmTurno:combatente.turnoV21+2});
    registrarLogV21(eventos,`${combatente.nativa.name} reduz em 2 o próximo dano físico recebido.`);
  } else if(id==='linhagem-v2-1-aves-de-rapina-grito-de-rapina') {
    guardarEfeito(combatente,{tipo:'reducao-dano',categoria:'especial',valor:2,expiraEmTurno:combatente.turnoV21+2});
    registrarLogV21(eventos,`${combatente.nativa.name} reduz em 2 o próximo dano especial recebido.`);
  } else if(id==='linhagem-v2-1-quelonios-vocalizacao-de-defesa') {
    guardarEfeito(combatente,{tipo:'reducao-dano',categoria:'geral',valor:1,expiraEmTurno:combatente.turnoV21+2});
    registrarLogV21(eventos,`${combatente.nativa.name} reduz em 1 o próximo dano recebido.`);
  }
}

function aplicarSecrecaoReativa(defensor,atacante,tecnica,evento,eventos) {
  if(tecnica.categoria!=='Físico')return;
  const secrecao=obterEfeito(defensor,'secrecao');
  if(!secrecao)return;
  consumirEfeito(defensor,'secrecao');
  registrarLogV21(eventos,`A secreção de ${defensor.nativa.name} é ativada pelo ataque físico de contato.`);
  if(secrecao.consequencia==='reducao-atq') aplicarReducaoAtributo(atacante,'ATQ',secrecao.origem,eventos,2);
  else if(secrecao.consequencia==='desorientacao') aplicarDesorientacao(atacante,eventos,secrecao.origem,2);
  else if(secrecao.consequencia==='dano-especial') {
    const reducao=obterReducaoDano(atacante,'Especial');
    const dano=Math.max(0,1-reducao.valor);
    if(reducao.efeito) consumirEfeito(atacante,'reducao-dano');
    atacante.hp=Math.max(0,atacante.hp-dano);
    registrarLogV21(eventos,`${atacante.nativa.name} recebe ${dano} dano especial reativo.`);
  }
}

function obterReducaoDano(combatente,categoria) {
  const efeito=obterEfeito(combatente,'reducao-dano');
  if(!efeito)return {valor:0,efeito:null};
  if(efeito.categoria==='geral'||efeito.categoria===categoria.toLowerCase())return {valor:efeito.valor,efeito};
  return {valor:0,efeito:null};
}

function processarFimDeTurno(combatente,eventos) {
  if(!(combatente.efeitosV21||[]).length&&!combatente.turnoV21)return;
  combatente.turnoV21=(combatente.turnoV21||0)+1;
  const efeitos=combatente.efeitosV21||[];
  const veneno=obterEfeito(combatente,'envenenamento');
  if(veneno) {
    combatente.hp=Math.max(0,combatente.hp-veneno.danoPorTurno);
    veneno.turnosRestantes-=1;
    registrarLogV21(eventos,`${combatente.nativa.name} sofre ${veneno.danoPorTurno} de dano por Envenenamento (${veneno.turnosRestantes} ocorrência(s) restante(s)).`);
    if(veneno.turnosRestantes<=0) consumirEfeito(combatente,'envenenamento');
  }
  const digestao=obterEfeito(combatente,'digestao');
  if(digestao) {
    combatente.hp=Math.max(0,combatente.hp-digestao.dano);
    registrarLogV21(eventos,`${combatente.nativa.name} sofre ${digestao.dano} de dano por Digestão.`);
    consumirEfeito(combatente,'digestao');
  }
  for(let i=efeitos.length-1;i>=0;i--) {
    const efeito=efeitos[i];
    if(efeito.expiraEmTurno!=null&&efeito.expiraEmTurno<=combatente.turnoV21) {
      efeitos.splice(i,1);
      registrarLogV21(eventos,`O efeito ${efeito.tipo} em ${combatente.nativa.name} termina.`);
    }
  }
}

function aplicarTecnicaV21(combatentes,indice,tecnica,random,eventos) {
  const combatente=combatentes[indice], adversario=combatentes[1-indice];
  if(tecnica.id==='linhagem-v2-1-serpentes-peconha-concentrada') {
    const veneno=obterEfeito(adversario,'envenenamento');
    if(!veneno)throw new Error('Peçonha Concentrada requer que o alvo esteja envenenado. Nenhum recurso foi gasto.');
    if(veneno.intensificado||adversario.venenoIntensificadoV21)throw new Error('O Envenenamento desse alvo já foi intensificado uma vez. Nenhum recurso foi gasto.');
  }
  if(combatente.cooldowns[tecnica.id]>0)throw new Error(`${tecnica.nome} está em recarga.`);
  if(combatente.mp<tecnica.mp)throw new Error(`${combatente.nativa.name} não tem MP suficiente.`);
  combatente.mp-=tecnica.mp;
  combatente.animacao='attack';
  if(tecnica.recarga>0)combatente.cooldowns[tecnica.id]=tecnica.recarga+1;

  if(EFEITOS_PREPARATORIOS_V21.has(tecnica.id)) {
    aplicarPreparacaoV21(combatente,tecnica,eventos);
    combatente.animacao='recover';
    return;
  }
  if(tecnica.id==='linhagem-v2-1-siluriformes-barbilhoes-sensoriais') {
    const def=atributoEfetivo(adversario,'DEF'), res=atributoEfetivo(adversario,'RES');
    const menor=def===res?'DEF e RES empatadas':def<res?'DEF':'RES';
    registrarLogV21(eventos,`${combatente.nativa.name} identifica ${menor} como a menor defesa de ${adversario.nativa.name}.`);
    combatente.animacao='recover';
    return;
  }

  const efeitoPrecisao=consumirEfeito(combatente,'bonus-precisao');
  const penalidadePrecisao=consumirEfeito(combatente,'desorientacao');
  const threshold=Math.max(0,Math.min(10,Math.abs(Number(tecnica.precisao)||0)-(efeitoPrecisao?.valor||0)+(penalidadePrecisao?.valor||0)));
  const roll=rolarD10(random);
  if(roll<=threshold) {
    eventos.push({type:'miss',attacker:combatente.nativa.name,technique:tecnica.nome,roll,threshold,bonusPrecisao:efeitoPrecisao?.valor||0,sinergias:[]});
    combatente.animacao='miss';
    return;
  }
  const hasDamage=TECNICAS_DANO_DIRETO_V21.has(tecnica.id);
  if(hasDamage) {
    const pgLiquido=tecnica.parametrosBalanceamento.pgLiquido;
    const bruto=Math.max(0,atributoEfetivo(combatente,'POT')+pgLiquido-atributoEfetivo(adversario,'RES'));
    const reducao=obterReducaoDano(adversario,'Especial');
    const dano=Math.max(0,bruto-reducao.valor);
    if(reducao.efeito)consumirEfeito(adversario,'reducao-dano');
    adversario.hp=Math.max(0,adversario.hp-dano);
    adversario.animacao='hit';
    eventos.push({type:'v21-hit',attacker:combatente.nativa.name,target:adversario.nativa.name,technique:tecnica.nome,roll,damage:dano});
  }
  if(tecnica.id==='linhagem-v2-1-serpentes-peconha-concentrada') {
    const veneno=obterEfeito(adversario,'envenenamento');
    veneno.danoPorTurno+=1;
    veneno.intensificado=true;
    adversario.venenoIntensificadoV21=true;
    registrarLogV21(eventos,`Peçonha Concentrada aumenta em 1 o dano das ocorrências de Envenenamento restantes em ${adversario.nativa.name}.`);
  } else {
    aplicarEfeitosAcertoV21(combatente,adversario,tecnica,eventos);
    if(!hasDamage)registrarLogV21(eventos,`${combatente.nativa.name} usa ${tecnica.nome}; efeito aplicado: ${tecnica.efeito}`);
  }
  combatente.animacao=hasDamage?'attack':'recover';
  if(hasDamage)aplicarSecrecaoReativa(adversario,combatente,tecnica,null,eventos);
}

export function avancarCombatentesDeTurno(combatentes) {
  return combatentes.map(combatente => {
    const atualizado = clonarCombatente(combatente);
    Object.keys(atualizado.cooldowns).forEach(id => {
      atualizado.cooldowns[id] = Math.max(0, atualizado.cooldowns[id] - 1);
      if (atualizado.cooldowns[id] === 0) delete atualizado.cooldowns[id];
    });
    atualizado.animacao = "";
    return atualizado;
  });
}

function rolarD10(random) {
  return Math.floor(random() * 10) + 1;
}

function aplicarTecnica(combatentes, indice, tecnicaId, random, eventos, biomaArena) {
  const combatente = combatentes[indice];
  const adversario = combatentes[1 - indice];
  if (combatente.hp <= 0 || adversario.hp <= 0) return;

  const tecnica = obterTecnicasCombatente(combatente).find(item => item.id === tecnicaId);
  if (!tecnica) throw new Error("Técnica não encontrada na ficha.");
  if (!podeUsarTecnicaEmCombate(tecnica)) throw new Error(`${tecnica.nome} pertence à V2.1 em revisão e ainda não possui parâmetros técnicos validados para uso em combate.`);
  if (tecnica.parametrosTecnicosDisponiveis === true && tecnica.versao === '2.1') {
    aplicarTecnicaV21(combatentes,indice,tecnica,random,eventos);
    return;
  }
  if (combatente.cooldowns[tecnica.id] > 0) throw new Error(`${tecnica.nome} está em recarga.`);
  if (combatente.mp < tecnica.mp) throw new Error(`${combatente.nativa.name} não tem MP suficiente.`);

  // Um mesmo ID de Traço só ativa uma entrada por resolução; nenhum Traço é requisito.
  const tracosJaAplicados = new Set();
  const sinergiasAtivas = (tecnica.sinergias || []).filter(sinergia => {
    if (!obterTracoPorId(sinergia.tracoId) || tracosJaAplicados.has(sinergia.tracoId)) return false;
    if (!nativaPossuiTraco(combatente.nativa, sinergia.tracoId)) return false;
    tracosJaAplicados.add(sinergia.tracoId);
    return true;
  });
  const bonusDano = sinergiasAtivas.filter(x => x.efeito.tipo === "bonus_dano").reduce((sum, x) => sum + x.efeito.valor, 0);
  const bonusPrecisao = sinergiasAtivas.filter(x => x.efeito.tipo === "bonus_precisao").reduce((sum, x) => sum + x.efeito.valor, 0);

  combatente.mp -= tecnica.mp;
  combatente.animacao = "attack";
  if (tecnica.recarga > 0) combatente.cooldowns[tecnica.id] = tecnica.recarga + 1;

  if (tecnica.categoria === "Suporte") {
    eventos.push({ type: "support", attacker: combatente.nativa.name, technique: tecnica.nome, description: tecnica.efeito, sinergias: sinergiasAtivas });
    combatente.animacao = "recover";
    return;
  }

  const roll = rolarD10(random);
  const bonusPrecisaoTemporario=consumirEfeito(combatente,'bonus-precisao');
  const desorientacao=consumirEfeito(combatente,'desorientacao');
  const threshold = Math.max(0, Math.min(10,Math.abs(Number(tecnica.precisao) || 0) - bonusPrecisao - (bonusPrecisaoTemporario?.valor||0) + (desorientacao?.valor||0)));
  if (tecnica.precisao !== null && roll <= threshold) {
    eventos.push({ type: "miss", attacker: combatente.nativa.name, technique: tecnica.nome, roll, threshold, bonusPrecisao: 0, sinergias: [] });
    combatente.animacao = "miss";
    return;
  }

  const physical = tecnica.categoria === "Físico";
  const offensive = physical ? atributoEfetivo(combatente,'ATQ') : atributoEfetivo(combatente,'POT');
  const defense = physical ? atributoEfetivo(adversario,'DEF') : atributoEfetivo(adversario,'RES');
  const techniqueDamage = danoNumerico(tecnica.dano);
  const baseDamage = Math.max(1, offensive + techniqueDamage - defense);
  const affinityModifier = modificadorAfinidade(combatente, adversario, tecnica);
  // Ponto de integração para consulta futura. Sem configuração, nenhum efeito é aplicado.
  obterModificadorTecnicaArena(tecnica.id, biomaArena);
  const danoSemSinergia = Math.max(0, baseDamage + affinityModifier);
  const danoBruto = Math.max(0,danoSemSinergia + bonusDano);
  const reducao=obterReducaoDano(adversario,physical?'Físico':'Especial');
  const damage = Math.max(0,danoBruto-reducao.valor);
  if(reducao.efeito)consumirEfeito(adversario,'reducao-dano');
  const thresholdBase = Math.max(0, Math.abs(Number(tecnica.precisao) || 0));
  const precisaoMudouResultado = tecnica.precisao !== null && roll <= thresholdBase && roll > threshold;
  const sinergiasEfetivas = sinergiasAtivas.filter(x => (x.efeito.tipo === "bonus_dano" && damage > danoSemSinergia) || (x.efeito.tipo === "bonus_precisao" && precisaoMudouResultado));
  const bonusDanoEfetivo = damage > danoSemSinergia ? bonusDano : 0;

  adversario.hp = Math.max(0, adversario.hp - damage);
  adversario.animacao = "hit";
  eventos.push({
    type: "hit", attacker: combatente.nativa.name, target: adversario.nativa.name,
    technique: tecnica.nome, roll, offensive, techniqueDamage, defense,
    baseDamage, affinityModifier, bonusDano: bonusDanoEfetivo, bonusPrecisao: precisaoMudouResultado ? bonusPrecisao : 0, sinergias: sinergiasEfetivas.map(x => ({ tracoId: x.tracoId, descricao: x.descricao, efeito: x.efeito })), damage
  });
  if(physical)aplicarSecrecaoReativa(adversario,combatente,tecnica,null,eventos);
}

function aplicarAcaoEspecial(combatentes, indice, tipo, eventos) {
  const combatente = combatentes[indice];
  if (tipo === "defend") {
    combatente.animacao = "defend";
    eventos.push({ type: "defend", fighter: combatente.nativa.name });
    return;
  }
  if (tipo === "recover") {
    const before = combatente.mp;
    combatente.mp = Math.min(combatente.maxMP, combatente.mp + 1);
    const recovered = combatente.mp - before;
    combatente.animacao = "recover";
    eventos.push({ type: "recover", fighter: combatente.nativa.name, recovered, mp: combatente.mp, maxMP: combatente.maxMP });
  }
}

/**
 * Resolve uma rodada seguindo a ordem e os cálculos usados anteriormente em app.js.
 * random deve ter a semântica de Math.random; no uso normal, Math.random é usado.
 */
export function resolverTurnoCombate({ fighters, choices, random = Math.random, biomaArena = null, invalidActionPolicy = "error" }) {
  const combatentes = fighters.map(clonarCombatente);
  const eventos = [];
  const rolls = combatentes.map(combatente => {
    const roll=rolarD10(random);
    const agi=atributoEfetivo(combatente,'AGI');
    const bonus=obterEfeito(combatente,'bonus-iniciativa')?.valor||0;
    if(bonus)consumirEfeito(combatente,'bonus-iniciativa');
    return {roll,agi,...(bonus?{bonus}: {})};
  });

  combatentes.forEach((combatente, indice) => {
    combatente.initiative = rolls[indice].roll + rolls[indice].agi + (rolls[indice].bonus||0);
  });

  const order = combatentes[0].initiative >= combatentes[1].initiative ? [0, 1] : [1, 0];
  eventos.push({
    type: "initiative",
    rolls: rolls.map((item, indice) => ({ ...item, initiative: combatentes[indice].initiative })),
    order,
    names: combatentes.map(item => item.nativa.name)
  });

  let error = null;
  try {
    for (const indice of order) {
      const combatente = combatentes[indice];
      const adversario = combatentes[1 - indice];
      if (combatente.hp <= 0 || adversario.hp <= 0) continue;
      const escolha = choices[indice];
      if (escolha?.tipo === "attack") {
        try { aplicarTecnica(combatentes, indice, escolha.tecnicaId, random, eventos, biomaArena); }
        catch (invalid) {
          if(invalidActionPolicy!=="defend")throw invalid;
          eventos.push({type:"invalid-action",message:`A ação de ${combatente.nativa.name} ficou indisponível durante o turno. A Nativa defende.`});
          aplicarAcaoEspecial(combatentes,indice,"defend",eventos);
        }
      }
      if (escolha?.tipo === "defend" || escolha?.tipo === "recover") {
        aplicarAcaoEspecial(combatentes, indice, escolha.tipo, eventos);
      }
      if(escolha?.tipo==='attack'||escolha?.tipo==='defend'||escolha?.tipo==='recover') processarFimDeTurno(combatente,eventos);
      if (adversario.hp <= 0) break;
    }
  } catch (caught) {
    error = caught;
  }

  const defeated = error ? null : combatentes.find(combatente => combatente.hp <= 0);
  if (defeated) {
    const winner = combatentes.find(combatente => combatente.hp > 0);
    eventos.push({ type: "defeat", defeated: defeated.nativa.name, winner: winner?.nativa.name || "ninguém" });
  }

  return {
    fighters: combatentes,
    rolls,
    order,
    events: eventos,
    ended: Boolean(defeated),
    error
  };
}
