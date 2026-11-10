import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TECNICAS } from "../js/techniques.js";
import { CATALOGO_TRACOS } from "../js/traits.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const docPath = resolve(root, "docs/catalogo-golpes-v2-2-1.md");
const esc = value => String(value ?? "—").replaceAll("|", "\\|").replaceAll("\r", " ").replaceAll("\n", " ");
const counts = key => TECNICAS.filter(move => move.origem === key).length;
const categoryCounts = Object.fromEntries(["Físico", "Especial", "Suporte"].map(category => [category, TECNICAS.filter(move => move.categoria === category).length]));
const statuses = [...new Set(TECNICAS.map(move => move.status))].map(status => [status, TECNICAS.filter(move => move.status === status).length]);
const headers = ["ID", "Nome", "Origem", "Grupo", "Categoria", "Afinidade", "Precisão", "Dano", "MP", "Recarga", "PG bruto", "P/R/M", "PG líquido", "Estado da fonte", "Estado no app", "Traços/Sinergias", "Descrição"];
const rows = TECNICAS.map(move => {
  const balance = move.parametrosBalanceamento;
  const associations = move.sinergias.map(item => `${item.tracoId}: ${item.efeito.tipo} ${item.efeito.valor} (${item.estadoRevisao})`);
  const candidates = move.sinergiasCandidatas.map(item => `${item.tracoId || item.nome}: candidata`);
  return [
    move.id, move.nome, move.origem, move.grupo, move.categoria, move.afinidade,
    move.precisao, move.dano, move.mp, move.recarga, move.pg,
    balance ? `${balance.P}/${balance.R}/${balance.M}` : "pendente",
    balance?.pgLiquido ?? "não se aplica/pendente", move.status, move.estadoCatalogo,
    [...associations, ...candidates].join("; ") || "—", move.efeito
  ];
});
const table = [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map(row => `| ${row.map(esc).join(" | ")} |`)
].join("\n");
const statusTable = statuses.map(([status, count]) => `| ${esc(status)} | ${count} |`).join("\n");
const content = `# Catálogo oficial de golpes NATIVA V2.2.1

Inventário gerado de \`js/techniques-v2-2-1.js\` por \`npm run catalog:inventory\`. A lista-base foi o arquivo integral de golpes enviado nesta tarefa; o segundo arquivo anexado não foi usado como catálogo.

## Totais auditados

| Grupo | Quantidade |
| --- | ---: |
| Linhagem | ${counts("linhagem")} |
| Bioma | ${counts("bioma")} |
| Arquétipo | ${counts("arquetipo")} |
| Afinidade | ${counts("afinidade")} |
| **Total** | **${TECNICAS.length}** |

| Categoria | Quantidade |
| --- | ---: |
| Físico | ${categoryCounts["Físico"]} |
| Especial | ${categoryCounts["Especial"]} |
| Suporte | ${categoryCounts.Suporte} |

| Estado da fonte | Quantidade |
| --- | ---: |
${statusTable}

O arquivo integral anterior de Linhagem tinha 105 golpes; a implementação V2.1 auditada tinha 108. A reconciliação individual preserva 154 IDs da implementação V2.1, arquiva os 12 golpes antigos de Arquétipo que não constam na V2.2 e incorpora 24 identidades ausentes: 4 de Bioma e 20 de Arquétipo. Os outros 105 IDs do catálogo V1 continuam consultáveis como arquivo para fichas antigas. Os 24 novos IDs estáveis são derivados da origem, grupo e nome porque a lista de origem não fornece IDs.

O catálogo contém ${CATALOGO_TRACOS.length} Traços. Oito sinergias têm correspondência exata de golpe, grupo e ID de Traço; as dez associações históricas sem correspondência exata não foram ativadas. Traços sem associação confirmada continuam opcionais.

Os quatro estados de fonte são preservados como vieram. Todos os registros ficam com estado interno \`em-revisao\` até haver aprovação explícita; parâmetros existentes não liberam combate. A função de combate aceita apenas registros aprovados e golpes arquivados já aprendidos, para compatibilidade com fichas antigas.

As colunas P/R/M, PG bruto e PG líquido reproduzem os valores da fonte. Suporte não recebe dano automático; PG líquido de suporte permanece como declarado na fonte (nulo quando não se aplica). Valores não fornecidos permanecem pendentes. PG é dado interno e não aparece na interface do jogador.

## Inventário integral

${table}

## Compatibilidade arquivada

\`js/techniques-archive.js\` conserva apenas os golpes antigos necessários para resolver IDs persistidos. \`js/techniques.js\` expõe apenas o catálogo V2.2.1 como ativo e consulta o arquivo de compatibilidade; os registros arquivados não aparecem no seletor de novos golpes.
`;

writeFileSync(docPath, content, "utf8");
console.log(`Inventário escrito: ${docPath} (${rows.length} golpes).`);
