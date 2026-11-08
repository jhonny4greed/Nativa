/** Regras conceituais compartilhadas da V2.1. Não são resolvidas pelo combate enquanto faltarem intensidades. */
export const REGRAS_EFEITOS_V2_1 = Object.freeze({
  desorientacao: Object.freeze({id:'desorientacao', tipo:'penalidade-precisao', momento:'próximo golpe ofensivo do alvo', expira:'fim do próximo turno do alvo se não consumida', acumula:false, intensidade:null, estado:'intensidade pendente'}),
  reducao_atributo: Object.freeze({id:'reducao_atributo', tipo:'reducao-atributo', atributos:['ATQ','AGI'], duracao:'até o fim do próximo turno do alvo', acumula:false, renovaDuracao:true, intensidade:null, estado:'atributo e intensidade definidos por técnica; valor pendente'}),
  reducao_dano: Object.freeze({id:'reducao_dano', tipo:'reducao-dano', momento:'próximo ataque recebido', expira:'fim do próximo turno do usuário se não consumida', acumula:false, intensidade:null, estado:'intensidade pendente'}),
  bonus_precisao: Object.freeze({id:'bonus_precisao', tipo:'bonus-precisao', momento:'próximo golpe ofensivo próprio', expira:'fim do próximo turno do usuário se não consumido', acumula:false, intensidade:null, estado:'intensidade pendente'}),
  envenenamento: Object.freeze({id:'envenenamento', tipo:'dano-periodico', aplicacao:'ao acertar', momento:'fim do turno do alvo', duracao:2, acumula:false, renovaDuracao:true, dano:null, estado:'dano por ocorrência pendente'}),
  digestao: Object.freeze({id:'digestao', tipo:'dano-periodico', momento:'fim do próximo turno do alvo', duracao:1, acumula:false, substituiAnterior:true, dano:null, estado:'dano pendente'}),
  secrecao_defensiva: Object.freeze({id:'secrecao_defensiva', tipo:'efeito-condicional-de-contato', duracaoUsuario:2, gatilho:'adversário acerta ataque físico de contato', ativacoes:1, acumula:false, estado:'intensidade/consequência conforme técnica'}),
  exploracao: Object.freeze({id:'exploracao', tipo:'utilidade-fora-de-combate', danoAutomatico:false, estado:'sem efeito numérico de combate'}),
  percepcao: Object.freeze({id:'percepcao', tipo:'percepcao-fora-de-combate', danoAutomatico:false, estado:'sem efeito numérico de combate'}),
  comunicacao: Object.freeze({id:'comunicacao', tipo:'comunicacao-fora-de-combate', danoAutomatico:false, estado:'sem efeito numérico de combate'})
});

// Chaves são IDs estáveis das técnicas. Magnitudes deliberadamente ausentes/nulas aguardam balanceamento.
const defs = {
  'linhagem-v2-1-felinos-rugido-da-cacadora': [{id:'desorientacao',regraId:'desorientacao',gatilho:'ao acertar'}],
  'linhagem-v2-1-canideos-faro-de-perseguicao': [{id:'rastreamento',regraId:'exploracao',gatilho:'fora de combate',detalhe:'acompanha rastros mesmo após tentativa de fuga',bonusAutomaticoCombate:false}],
  'linhagem-v2-1-mustelideos-secrecao-defensiva': [{id:'secrecao-reducao-atq-contato',regraId:'secrecao_defensiva',gatilho:'acerto do adversário com ataque físico de contato',consequencia:'reducao-atq',duracao:'até o fim do próximo turno do alvo',intensidade:null}],
  'linhagem-v2-1-procionideos-exploracao-atenta': [{id:'investigacao-ambiente',regraId:'exploracao',gatilho:'fora de combate',detalhe:'encontra pistas, objetos, esconderijos e perigos'}],
  'linhagem-v2-1-roedores-alerta-da-colonia': [{id:'alerta-iniciativa',regraId:'percepcao',gatilho:'detecção de ameaça',contextoCombate:'próxima rolagem de iniciativa',bonus:null}],
  'linhagem-v2-1-marsupiais-falsa-morte': [{id:'reducao-dano-geral-intensa',regraId:'reducao_dano',tipoDano:'geral',intensidadeRelativa:'maior',intensidade:null}],
  'linhagem-v2-1-marsupiais-secrecao-repulsiva': [{id:'secrecao-desorientacao-contato',regraId:'secrecao_defensiva',gatilho:'acerto do adversário com ataque físico de contato',consequencia:'desorientacao',intensidade:null}],
  'linhagem-v2-1-primatas-grito-de-alerta': [{id:'desorientacao',regraId:'desorientacao',gatilho:'ao acertar'}],
  'linhagem-v2-1-morcegos-ecolocalizacao': [{id:'ecolocalizacao',regraId:'percepcao',gatilho:'fora de combate',detalhe:'detecta criaturas e obstáculos sem visão, inclusive com baixa visibilidade'}],
  'linhagem-v2-1-morcegos-pulso-ultrassonico': [{id:'dano-especial',regraId:null,valor:null,estado:'dano especial segue pendente no campo dano'},{id:'desorientacao',regraId:'desorientacao',gatilho:'ao acertar'}],
  'linhagem-v2-1-morcegos-voo-erratico': [{id:'reducao-dano-fisico',regraId:'reducao_dano',tipoDano:'físico',intensidade:null}],
  'linhagem-v2-1-xenartros-lingua-capturadora': [{id:'dano-especial',regraId:null,valor:null,estado:'dano especial segue pendente no campo dano'},{id:'reducao-agi',regraId:'reducao_atributo',atributo:'AGI',momento:'até o fim do próximo turno do alvo',afetaIniciativa:true,intensidade:null}],
  'linhagem-v2-1-ungulados-brado-territorial': [{id:'desorientacao',regraId:'desorientacao',gatilho:'ao acertar'}],
  'linhagem-v2-1-aves-de-rapina-grito-de-rapina': [{id:'reducao-dano-especial',regraId:'reducao_dano',tipoDano:'especial',intensidade:null}],
  'linhagem-v2-1-aves-corredoras-e-campestres-chamado-de-advertencia': [{id:'alerta-fora-de-combate',regraId:'percepcao',gatilho:'fora de combate',detalhe:'alerta sobre ameaças próximas'},{id:'bonus-precisao',regraId:'bonus_precisao',gatilho:'em combate',momento:'próximo golpe ofensivo próprio',intensidade:null}],
  'linhagem-v2-1-aves-aquaticas-e-pernaltas-chamado-do-bando': [{id:'comunicacao-entre-aves',regraId:'comunicacao',gatilho:'fora de combate',detalhe:'transmite alertas e informações a aves próximas'}],
  'linhagem-v2-1-psitacideos-vocalizacao-imitativa': [{id:'imitacao-sonora',regraId:'exploracao',gatilho:'fora de combate',detalhe:'distrai, atrai ou confunde criaturas'},{id:'desorientacao',regraId:'desorientacao',gatilho:'pode aplicar em combate',intensidade:null}],
  'linhagem-v2-1-serpentes-bote-de-jararaca': [{id:'dano-especial',regraId:null,valor:null,estado:'dano especial segue pendente no campo dano'},{id:'envenenamento',regraId:'envenenamento',gatilho:'ao acertar'}],
  'linhagem-v2-1-serpentes-peconha-concentrada': [{id:'intensificar-envenenamento',regraId:'envenenamento',gatilho:'requer alvo já envenenado',acumula:false,limiteIntensificacao:null,estado:'limite/intensidade pendentes'}],
  'linhagem-v2-1-lagartos-ameaca-visual': [{id:'desorientacao',regraId:'desorientacao',gatilho:'ao acertar'}],
  'linhagem-v2-1-quelonios-vocalizacao-de-defesa': [{id:'reducao-dano-geral-leve',regraId:'reducao_dano',tipoDano:'geral',intensidadeRelativa:'menor',intensidade:null}],
  'linhagem-v2-1-anuros-secrecao-defensiva': [{id:'secrecao-dano-especial-contato',regraId:'secrecao_defensiva',gatilho:'acerto do adversário com ataque físico de contato',consequencia:'dano-especial',dano:null}],
  'linhagem-v2-1-anuros-vocalizacao-intimidante': [{id:'reducao-atq',regraId:'reducao_atributo',atributo:'ATQ',momento:'até o fim do próximo turno do alvo',intensidade:null}],
  'linhagem-v2-1-peixes-eletricos-descarga-do-poraque': [{id:'dano-especial',regraId:null,valor:null,estado:'dano especial segue pendente no campo dano'},{id:'reducao-atq',regraId:'reducao_atributo',atributo:'ATQ',momento:'até o fim do próximo turno do alvo',intensidade:null}],
  'linhagem-v2-1-peixes-eletricos-pulso-de-alta-voltagem': [{id:'dano-especial-elevado',regraId:null,valor:null,estado:'dano/intensidade elevada pendentes'},{id:'desorientacao',regraId:'desorientacao',gatilho:'ao acertar',intensidade:null}],
  'linhagem-v2-1-characiformes-descarga-de-muco': [{id:'desorientacao',regraId:'desorientacao',gatilho:'ao acertar',detalhe:'penaliza a precisão do próximo golpe ofensivo do adversário'}],
  'linhagem-v2-1-siluriformes-barbilhoes-sensoriais': [{id:'analise-defesa-menor',regraId:'percepcao',gatilho:'ao usar',detalhe:'revela a menor entre DEF e RES do adversário'}],
  'linhagem-v2-1-peixes-cartilaginosos-percepcao-do-tubarao-martelo': [{id:'bonus-precisao',regraId:'bonus_precisao',gatilho:'ao usar',momento:'próximo golpe ofensivo próprio',intensidade:null}],
  'linhagem-v2-1-aracnideos-picada-venenosa': [{id:'dano-especial',regraId:null,valor:null,estado:'dano especial segue pendente no campo dano'},{id:'envenenamento',regraId:'envenenamento',gatilho:'ao acertar'}],
  'linhagem-v2-1-aracnideos-pelos-urticantes': [{id:'desorientacao',regraId:'desorientacao',gatilho:'ao acertar'}],
  'linhagem-v2-1-insetos-sociais-acido-defensivo': [{id:'dano-especial',regraId:null,valor:null,estado:'dano especial segue pendente no campo dano'},{id:'reducao-atq',regraId:'reducao_atributo',atributo:'ATQ',momento:'até o fim do próximo turno do alvo',intensidade:null}],
  'linhagem-v2-1-insetos-predadores-enzimas-digestivas': [{id:'dano-especial',regraId:null,valor:null,estado:'dano especial segue pendente no campo dano'},{id:'digestao',regraId:'digestao',gatilho:'ao acertar',dano:null}]
};

export const EFEITOS_CONCEITUAIS_POR_TECNICA_V2_1 = Object.freeze(Object.fromEntries(
  Object.entries(defs).map(([id,efeitos]) => [id,Object.freeze(efeitos.map(efeito=>Object.freeze({...efeito})))])
));

export function obterEfeitosConceituaisV2_1(tecnicaId) {
  return EFEITOS_CONCEITUAIS_POR_TECNICA_V2_1[tecnicaId] || Object.freeze([]);
}
